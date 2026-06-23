#!/usr/bin/env bash
#
# Деплой grafic.admsr.ru с GitHub на Ubuntu.
#
# Использование:
#   cd /var/www/grafic.admsr.ru/html
#   ./deploy/deploy.sh
#
# Опции:
#   -b main          ветка для git pull (по умолчанию — текущая tracking-ветка)
#   -n, --dry-run    только показать шаги, ничего не менять
#   --skip-backup    не делать бэкап SQLite
#   --skip-pull      не делать git pull (только сборка и перезапуск)
#
# Переменные окружения (необязательно):
#   APP_DIR, DB_DIR, DB_FILE, SERVICE_NAME, BACKUP_KEEP, HEALTH_URL
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
DB_DIR="${DB_DIR:-/var/lib/crm-schedule}"
DB_FILE="${DB_FILE:-$DB_DIR/crm.sqlite}"
SERVICE_NAME="${SERVICE_NAME:-grafic-api}"
BACKUP_DIR="${BACKUP_DIR:-$DB_DIR/backups}"
BACKUP_KEEP="${BACKUP_KEEP:-14}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3001/api/health}"

GIT_BRANCH=""
DRY_RUN=0
SKIP_BACKUP=0
SKIP_PULL=0

log() { printf '\033[1;34m[deploy]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[deploy]\033[0m %s\n' "$*" >&2; }
err() { printf '\033[1;31m[deploy]\033[0m %s\n' "$*" >&2; }

usage() {
  sed -n '3,16p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

run() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "[dry-run] $*"
    return 0
  fi
  "$@"
}

sudo_run() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "[dry-run] sudo $*"
    return 0
  fi
  sudo "$@"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help) usage 0 ;;
    -n|--dry-run) DRY_RUN=1; shift ;;
    --skip-backup) SKIP_BACKUP=1; shift ;;
    --skip-pull) SKIP_PULL=1; shift ;;
    -b)
      [[ $# -ge 2 ]] || { err "Опция -b требует имя ветки"; exit 1; }
      GIT_BRANCH="$2"
      shift 2
      ;;
    *) err "Неизвестный аргумент: $1"; usage 1 ;;
  esac
done

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { err "Не найдена команда: $1"; exit 1; }
}

for cmd in git pnpm curl; do
  require_cmd "$cmd"
done

if [[ ! -d "$APP_DIR/.git" ]]; then
  err "Каталог приложения не является git-репозиторием: $APP_DIR"
  exit 1
fi

if [[ ! -f "$APP_DIR/server/.env" ]]; then
  warn "Нет server/.env — API может не запуститься после деплоя"
fi

STAMP="$(date +%F-%H%M%S)"

backup_database() {
  [[ "$SKIP_BACKUP" -eq 1 ]] && { log "Бэкап пропущен (--skip-backup)"; return 0; }

  if [[ ! -f "$DB_FILE" ]]; then
    warn "База не найдена ($DB_FILE), бэкап пропущен"
    return 0
  fi

  log "Бэкап SQLite → $BACKUP_DIR"
  run sudo_run mkdir -p "$BACKUP_DIR"

  local base="$BACKUP_DIR/crm.sqlite.bak.$STAMP"
  run sudo_run cp -a "$DB_FILE" "$base"
  run sudo_run cp -a "${DB_FILE}-wal" "${base}-wal" 2>/dev/null || true
  run sudo_run cp -a "${DB_FILE}-shm" "${base}-shm" 2>/dev/null || true

  if [[ "$DRY_RUN" -eq 0 ]]; then
    mapfile -t old_backups < <(sudo ls -1t "$BACKUP_DIR"/crm.sqlite.bak.* 2>/dev/null | grep -E '\.bak\.[0-9]{4}-' || true)
    local count="${#old_backups[@]}"
    if [[ "$count" -gt "$BACKUP_KEEP" ]]; then
      local i
      for ((i = BACKUP_KEEP; i < count; i++)); do
        local stem="${old_backups[$i]}"
        sudo rm -f "$stem" "${stem}-wal" "${stem}-shm" 2>/dev/null || true
      done
      log "Удалены старые бэкапы (оставлено последних $BACKUP_KEEP)"
    fi
  fi
}

pull_code() {
  [[ "$SKIP_PULL" -eq 1 ]] && { log "git pull пропущен (--skip-pull)"; return 0; }

  log "Обновление кода из git ($APP_DIR)"
  run cd "$APP_DIR"

  local branch="$GIT_BRANCH"
  if [[ -z "$branch" ]]; then
    branch="$(git symbolic-ref --short HEAD 2>/dev/null || true)"
  fi

  if [[ -n "$branch" ]]; then
    run git fetch origin "$branch"
    run git checkout "$branch"
    run git pull --ff-only origin "$branch"
  else
    run git fetch origin
    run git pull --ff-only
  fi

  local sha
  sha="$(git rev-parse --short HEAD)"
  log "Текущий коммит: $sha"
}

build_app() {
  log "Установка зависимостей и сборка"
  run cd "$APP_DIR"
  run pnpm install --frozen-lockfile 2>/dev/null || run pnpm install
  run pnpm build:server
  run pnpm build
}

restart_service() {
  log "Перезапуск $SERVICE_NAME"
  run sudo_run systemctl restart "$SERVICE_NAME"
}

wait_for_health() {
  log "Проверка API: $HEALTH_URL"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    return 0
  fi

  local attempt
  for attempt in 1 2 3 4 5 6 7 8 9 10; do
    if curl -sf "$HEALTH_URL" >/dev/null; then
      log "API отвечает (попытка $attempt)"
      return 0
    fi
    sleep 1
  done

  err "API не ответил на $HEALTH_URL"
  err "Смотрите: journalctl -u $SERVICE_NAME -n 50 --no-pager"
  exit 1
}

main() {
  log "Старт деплоя grafic.admsr.ru"
  log "APP_DIR=$APP_DIR"
  [[ "$DRY_RUN" -eq 1 ]] && warn "Режим dry-run — изменения не применяются"

  backup_database
  pull_code
  build_app
  restart_service
  wait_for_health

  log "Готово. Сайт обновлён."
}

main
