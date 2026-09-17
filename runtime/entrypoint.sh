#!/bin/sh
set -eu

profile_name="fork"
profile_home="${HERMES_HOME:-/opt/data}/profiles/${profile_name}"

for source in /fork-config/SOUL.md /fork-config/SKILL.md /fork-config/config.json \
    /opt/fork/secrets/profile.env; do
    if [ ! -f "$source" ] || [ -L "$source" ]; then
        echo "[fork] missing required regular file: $source" >&2
        exit 1
    fi
done

if [ ! -d "$profile_home" ]; then
    /opt/hermes/.venv/bin/hermes profile create "$profile_name" --no-alias --no-skills
fi

install -m 0600 /opt/fork/secrets/profile.env /run/profile.env
ln -sfn /run/profile.env "$profile_home/.env"

set_profile() (
    set -a
    . /run/profile.env
    set +a
    if [ -f /opt/fork/profile-avatar ]; then
        avatar_url="$(
            /usr/local/bin/buzz upload file --file /opt/fork/profile-avatar \
                | /opt/hermes/.venv/bin/python -c 'import json,sys; print(json.load(sys.stdin)["url"])'
        )"
        /usr/local/bin/buzz users set-profile \
            --name "$FORK_PROFILE_NAME" \
            --about "$FORK_PROFILE_ABOUT" \
            --avatar "$avatar_url"
    else
        /usr/local/bin/buzz users set-profile \
            --name "$FORK_PROFILE_NAME" \
            --about "$FORK_PROFILE_ABOUT"
    fi
)

profile_status=0
profile_result="$({
    set -a
    . /run/profile.env
    set +a
    /usr/local/bin/buzz users get
} 2>&1)" || profile_status=$?
if [ "${profile_status:-0}" -ne 0 ] && ! printf '%s' "$profile_result" | grep -qi 'no profile'; then
    echo "[fork] failed to read Buzz profile: $profile_result" >&2
    exit "$profile_status"
fi
if ! printf '%s' "$profile_result" | grep -q '"pubkey"' || [ -f /opt/fork/profile-avatar ]; then
    set_profile
fi

/opt/hermes/.venv/bin/python /opt/fork/merge_config.py \
    /opt/fork/config.base.json /fork-config/config.json "$profile_home/config.yaml"

install -m 0444 /fork-config/SOUL.md "$profile_home/SOUL.md"
install -d -m 0700 "$profile_home/skills/$profile_name"
install -m 0444 /fork-config/SKILL.md "$profile_home/skills/$profile_name/SKILL.md"

export HERMES_HOME="$profile_home"
touch /run/fork-secrets-ready
exec /opt/hermes/docker/main-wrapper.sh "$@"
