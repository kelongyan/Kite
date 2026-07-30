# kite-shell-integration (fish)
# Emits OSC 7 (cwd) + OSC 133 A/B/C/D so the host tracks cwd and prompt
# boundaries without re-parsing the prompt. fish 4.0+ writes its own OSC 133
# A/B (the `mark-prompt` feature); Kite disables it at spawn via
# fish_features=no-mark-prompt so these markers aren't emitted twice.

# Installed into conf.d, which every fish session sources; only Kite-spawned
# shells (KITE_TERMINAL=1) may get their prompt wrapped.
if not set -q KITE_TERMINAL
    exit 0
end
if set -q __KITE_HOOKS_LOADED
    exit 0
end
set -g __KITE_HOOKS_LOADED 1

# Kite is a clean terminal; drop fish's default startup greeting. A user who
# sets their own in config.fish (sourced after this) keeps it.
function fish_greeting
end

set -g __KITE_HOST (uname -n 2>/dev/null; or echo localhost)

# URL-encode a path keeping `/` intact so it stays valid inside file://.
function __kite_urlencode_path
    set -l parts (string split '/' -- $argv[1])
    set -l out
    for p in $parts
        if test -n "$p"
            set out $out (string escape --style=url -- $p)
        else
            set out $out ""
        end
    end
    string join '/' $out
end

function __kite_restore_status
    return $argv[1]
end

function __kite_capture_user_prompt
    if not functions -q fish_prompt
        return
    end
    if functions fish_prompt | string match -q '*__kite_user_prompt*'
        return
    end
    functions -e __kite_user_prompt 2>/dev/null
    functions -c fish_prompt __kite_user_prompt
end

# Wrapped so `fish -C __kite_install_prompt` can re-run it AFTER config.fish,
# where a framework prompt (starship etc.) would otherwise override fish_prompt
# and drop our markers.
function __kite_install_prompt
    __kite_capture_user_prompt
    function fish_prompt
        set -l __kite_status $status
        printf '\e]133;D;%d\e\\' $__kite_status
        printf '\e]7;file://%s%s\e\\' "$__KITE_HOST" (__kite_urlencode_path "$PWD")
        printf '\e]133;A\e\\'
        __kite_restore_status $__kite_status
        if functions -q __kite_user_prompt
            __kite_user_prompt
        else
            printf '%s > ' (prompt_pwd)
        end
        printf '\e]133;B\e\\'
    end
end
__kite_install_prompt

function __kite_preexec --on-event fish_preexec
    set -l cmd (string replace -ra '[\x00-\x1f\x7f]' ' ' -- "$argv")
    printf '\e]133;C;%s\e\\' (string sub -l 256 -- "$cmd")
end
