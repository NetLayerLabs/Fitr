#!/usr/bin/env bash
# Build the signed release APK of the Fitr Android shell (android/fitr-shell).
#
#   FITR_KEYSTORE_PATH=~/.fitr/keys/fitr-release.keystore \
#   FITR_KEYSTORE_PASSWORD='...' \
#   android/build-release.sh [--version-code N --version-name X.Y.Z]
#
# The password can also come from SOLANA_MOBILE_KEYSTORE_PASSWORD. Nothing secret is written to disk.
# Toolchain (see docs/android.md): Homebrew openjdk@17 + android-commandlinetools.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project="$here/fitr-shell"

export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
export PATH="$JAVA_HOME/bin:$PATH"

keystore="${FITR_KEYSTORE_PATH:-}"
alias_name="${FITR_KEYSTORE_ALIAS:-fitr-release}"
password="${FITR_KEYSTORE_PASSWORD:-${SOLANA_MOBILE_KEYSTORE_PASSWORD:-}}"

if [[ -z "$keystore" || ! -f "$keystore" ]]; then
  echo "FITR_KEYSTORE_PATH must point at the release keystore (got: '${keystore}')." >&2
  exit 1
fi
if [[ -z "$password" ]]; then
  read -r -s -p "Keystore password: " password; echo
fi

extra=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --version-code) extra+=("-PSOLANA_MOBILE_VERSION_CODE=$2"); shift 2 ;;
    --version-name) extra+=("-PSOLANA_MOBILE_VERSION_NAME=$2"); shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

cd "$project"
SOLANA_MOBILE_KEYSTORE_PASSWORD="$password" SOLANA_MOBILE_KEY_PASSWORD="$password" \
  ./gradlew assembleRelease --no-daemon \
  "-PSOLANA_MOBILE_KEYSTORE_PATH=$keystore" "-PSOLANA_MOBILE_KEYSTORE_ALIAS=$alias_name" \
  ${extra[@]+"${extra[@]}"}

apk="$project/app/build/outputs/apk/release/app-release.apk"
bt="$(ls -d "$ANDROID_HOME"/build-tools/* | sort -V | tail -1)"
echo
echo "APK: $apk ($(du -h "$apk" | cut -f1))"
"$bt/apksigner" verify --print-certs "$apk" | grep -E "SHA-256 digest"
echo "Compare with public/.well-known/assetlinks.json (uppercase, colon-separated)."
