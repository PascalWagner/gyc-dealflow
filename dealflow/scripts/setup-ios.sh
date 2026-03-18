#!/bin/bash
# GYC Deals — iOS App Store Setup Script
# Automates: npm install, cap sync, pod install, build, and opens Xcode
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

echo "╔══════════════════════════════════════════════╗"
echo "║  GYC Deals — iOS App Store Setup             ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# Step 1: Check prerequisites
echo "▸ Checking prerequisites..."

if ! command -v node &>/dev/null; then
  echo "✗ Node.js is not installed. Install via: brew install node"
  exit 1
fi
echo "  ✓ Node.js $(node -v)"

if ! command -v xcodebuild &>/dev/null; then
  echo "✗ Xcode is not installed. Install from the Mac App Store."
  exit 1
fi
echo "  ✓ $(xcodebuild -version | head -1)"

if ! command -v pod &>/dev/null; then
  echo "⚠ CocoaPods not found. Installing via Homebrew..."
  brew install cocoapods
fi
echo "  ✓ CocoaPods $(pod --version)"

# Step 2: Install npm dependencies
echo ""
echo "▸ Installing dependencies..."
npm install

# Step 3: Add iOS platform if needed
if [ ! -d "ios" ]; then
  echo ""
  echo "▸ Adding iOS platform..."
  npx cap add ios
else
  echo ""
  echo "▸ Syncing iOS project..."
  npx cap copy ios
fi

# Step 4: Pod install
echo ""
echo "▸ Running pod install..."
cd ios/App
pod install
cd "$PROJECT_DIR"

# Step 5: Test build
echo ""
echo "▸ Building for simulator (verification)..."
xcodebuild -workspace ios/App/App.xcworkspace \
  -scheme App \
  -destination 'generic/platform=iOS Simulator' \
  -configuration Debug \
  build 2>&1 | tail -3

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  ✓ Setup complete!                           ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "Next steps (manual in Xcode):"
echo ""
echo "  1. Open Xcode:"
echo "     npx cap open ios"
echo ""
echo "  2. Select the 'App' target → Signing & Capabilities"
echo "     • Set your Team (Apple Developer account)"
echo "     • Bundle ID: io.growyourcashflow.dealflow"
echo ""
echo "  3. Add Push Notifications capability:"
echo "     • + Capability → Push Notifications"
echo ""
echo "  4. Take screenshots on simulators:"
echo "     • iPhone 15 Pro Max (6.7\")"
echo "     • iPhone 11 Pro Max (6.5\")"
echo ""
echo "  5. Archive & Upload:"
echo "     • Product → Archive"
echo "     • Distribute App → App Store Connect"
echo ""
echo "  6. Fill in App Store Connect metadata:"
echo "     • See APP_STORE_METADATA.md for all copy"
echo ""
