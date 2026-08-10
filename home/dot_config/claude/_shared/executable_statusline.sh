#!/bin/bash
input=$(cat)

# --- Extract fields ---
MODEL=$(echo "$input" | jq -r '.model.display_name // "?"' | sed 's/ (1M context)//')
PCT=$(echo "$input" | jq -r '.context_window.used_percentage // 0' | cut -d. -f1)
COST=$(echo "$input" | jq -r '.cost.total_cost_usd // 0')
ADDED=$(echo "$input" | jq -r '.cost.total_lines_added // 0')
REMOVED=$(echo "$input" | jq -r '.cost.total_lines_removed // 0')

# Rate limits (not yet available in statusline JSON, ready for future support)
FIVE_H=$(echo "$input" | jq -r '.rate_limits.five_hour.used_percentage // empty' 2>/dev/null | cut -d. -f1)
SEVEN_D=$(echo "$input" | jq -r '.rate_limits.seven_day.used_percentage // empty' 2>/dev/null | cut -d. -f1)
FIVE_H_RESET=$(echo "$input" | jq -r '.rate_limits.five_hour.resets_at // empty' 2>/dev/null)

# --- Colors ---
GREEN='\033[32m'; YELLOW='\033[33m'; RED='\033[31m'
CYAN='\033[36m'; DIM='\033[2m'; RESET='\033[0m'

# --- Helper: color by threshold ---
color_for() {
  local val=$1
  if [ "$val" -ge 90 ]; then echo "$RED"
  elif [ "$val" -ge 70 ]; then echo "$YELLOW"
  else echo "$GREEN"; fi
}

# --- Helper: progress bar (10 chars) ---
bar() {
  local val=$1 width=10
  local filled=$((val * width / 100))
  [ "$filled" -gt "$width" ] && filled=$width
  local empty=$((width - filled))
  local b=""
  [ "$filled" -gt 0 ] && printf -v f "%${filled}s" && b="${f// /█}"
  [ "$empty" -gt 0 ] && printf -v e "%${empty}s" && b="${b}${e// /░}"
  echo "$b"
}

# --- Line 1: Model, Context, Cost, Lines changed ---
CTX_COLOR=$(color_for "$PCT")
CTX_BAR=$(bar "$PCT")
COST_FMT=$(printf '$%.2f' "$COST")

LINE1="${CYAN}[${MODEL}]${RESET} ctx ${CTX_COLOR}${CTX_BAR} ${PCT}%${RESET}"
LINE1="${LINE1} ${DIM}|${RESET} ${YELLOW}${COST_FMT}${RESET}"
[ "$ADDED" -gt 0 ] || [ "$REMOVED" -gt 0 ] && LINE1="${LINE1} ${DIM}|${RESET} ${GREEN}+${ADDED}${RESET}/${RED}-${REMOVED}${RESET}"

echo -e "$LINE1"

# --- Line 2: Rate limits (only shown when data is available) ---
LINE2=""
if [ -n "$FIVE_H" ]; then
  FIVE_COLOR=$(color_for "$FIVE_H")
  FIVE_BAR=$(bar "$FIVE_H")
  LINE2="5h ${FIVE_COLOR}${FIVE_BAR} ${FIVE_H}%${RESET}"

  if [ -n "$FIVE_H_RESET" ]; then
    RESET_LOCAL=$(TZ=Asia/Tokyo date -j -f "%Y-%m-%dT%H:%M:%SZ" "$FIVE_H_RESET" "+%H:%M" 2>/dev/null || date -d "$FIVE_H_RESET" "+%H:%M" 2>/dev/null)
    [ -n "$RESET_LOCAL" ] && LINE2="${LINE2} ${DIM}(${RESET_LOCAL})${RESET}"
  fi
fi

if [ -n "$SEVEN_D" ]; then
  SEVEN_COLOR=$(color_for "$SEVEN_D")
  SEVEN_BAR=$(bar "$SEVEN_D")
  [ -n "$LINE2" ] && LINE2="${LINE2} ${DIM}|${RESET} "
  LINE2="${LINE2}7d ${SEVEN_COLOR}${SEVEN_BAR} ${SEVEN_D}%${RESET}"
fi

if [ -n "$LINE2" ]; then
  echo -e "$LINE2"
fi
