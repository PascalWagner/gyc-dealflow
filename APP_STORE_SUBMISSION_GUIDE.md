# Cashflow Academy — App Store Submission Guide

**Goal:** Get the Cashflow Academy iOS app submitted and published on the App Store.

**Status as of 2026-03-19:** App is built, signed, and exported as IPA. App Store Connect access is not yet active (new developer account provisioning). Everything else is ready.

---

## Apple Developer Account

- **Apple ID:** pmoneywagner@icloud.com
- **Team ID:** XQ875KQN2R
- **Program:** Apple Developer Program (Individual)
- **Bundle ID:** io.growyourcashflow.dealflow
- **App Name:** Cashflow Academy
- **Enrollment confirmed** — but Chase initially declined the $99 payment as fraud. Pascal approved it with Chase. Apple's enrollment page says "already Account Holder." App Store Connect may need time to propagate, or payment may need to be retried.

---

## What's Already Done

1. **Capacitor iOS project** is set up at `/Users/pascalwagner/Documents/New project/dealflow/dealflow/`
2. **Xcode signing** configured with Team ID XQ875KQN2R in `ios/App/App.xcodeproj/project.pbxproj`
3. **Apple ID** added to Xcode Accounts (pmoneywagner@icloud.com)
4. **App-specific password** stored in macOS keychain as "AC_PASSWORD" for pmoneywagner@icloud.com
5. **App archived and exported** — IPA may be at `/tmp/CashflowAcademyExport/App.ipa` (temp files may be cleaned up)
6. **Metadata** written in `/Users/pascalwagner/Documents/New project/dealflow/dealflow/APP_STORE_METADATA.md`
7. **Login page redesigned** — Cashflow Academy branding, mobile-first
8. **Mobile UI optimized** — filters, tabs, sticky nav all done
9. **Test account** exists in GoHighLevel: test@test.com / test
10. **App icon** at `dealflow/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-1024x1024.png`

---

## What Still Needs to Happen

### Step 1: Verify App Store Connect Access

Try accessing App Store Connect:
```bash
xcrun altool --validate-app -f /tmp/CashflowAcademyExport/App.ipa -t ios -u pmoneywagner@icloud.com --password "@keychain:AC_PASSWORD" 2>&1
```

Or navigate to https://appstoreconnect.apple.com/apps in a browser signed in with pmoneywagner@icloud.com.

**If it fails:** The payment may not have gone through. Check:
- https://developer.apple.com/account — does it show Team ID and renewal date?
- https://developer.apple.com/enroll/ — does it say "already Account Holder"?
- If payment failed, retry enrollment at https://developer.apple.com/enroll/

### Step 2: Rebuild IPA (if temp files were cleaned up)

```bash
cd /Users/pascalwagner/Documents/New\ project/dealflow/dealflow

# Sync Capacitor
LANG=en_US.UTF-8 npx cap sync ios

# Archive
LANG=en_US.UTF-8 xcodebuild -workspace ios/App/App.xcworkspace -scheme App \
  -destination 'generic/platform=iOS' \
  -archivePath /tmp/CashflowAcademy.xcarchive archive \
  -allowProvisioningUpdates

# Export IPA
cat > /tmp/ExportLocal.plist << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key><string>app-store-connect</string>
    <key>destination</key><string>export</string>
    <key>signingStyle</key><string>automatic</string>
    <key>teamID</key><string>XQ875KQN2R</string>
    <key>uploadSymbols</key><true/>
    <key>manageAppVersionAndBuildNumber</key><true/>
</dict>
</plist>
PLIST

LANG=en_US.UTF-8 xcodebuild -exportArchive \
  -archivePath /tmp/CashflowAcademy.xcarchive \
  -exportOptionsPlist /tmp/ExportLocal.plist \
  -exportPath /tmp/CashflowAcademyExport \
  -allowProvisioningUpdates
```

### Step 3: Create App in App Store Connect

Go to https://appstoreconnect.apple.com/apps → "+" → "New App":
- **Platform:** iOS
- **Name:** Cashflow Academy
- **Bundle ID:** io.growyourcashflow.dealflow (select from dropdown after upload)
- **SKU:** cashflow-academy
- **Primary Language:** English (U.S.)

### Step 4: Upload IPA

```bash
xcrun altool --upload-app \
  -f /tmp/CashflowAcademyExport/App.ipa \
  -t ios \
  -u pmoneywagner@icloud.com \
  --password "@keychain:AC_PASSWORD"
```

**If keychain password is missing**, re-add it:
```bash
security add-generic-password -a "pmoneywagner@icloud.com" -s "AC_PASSWORD" -w "YOUR_APP_SPECIFIC_PASSWORD" -U login.keychain-db
```
Generate a new app-specific password at https://account.apple.com → Sign-In and Security → App-Specific Passwords.

### Step 5: Fill in App Store Metadata

In App Store Connect, fill in the app listing:

- **Subtitle:** Find, Vet & Invest in CRE Deals
- **Category:** Finance (primary), Business (secondary)
- **Price:** Free
- **Content Rating:** 17+ (Unrestricted Web Access)
- **Privacy Policy URL:** https://dealflow-puce.vercel.app/privacy.html
- **Support URL:** https://growyourcashflow.io
- **Marketing URL:** https://growyourcashflow.io
- **Keywords:** real estate investing, deal marketplace, investment deals, multifamily, self storage, commercial real estate, syndication, passive income, alternative investments, CRE

**Description:**
```
Whether you can't find enough deals or you don't know how to vet the ones you find — you're leaving money on the table either way.

Cashflow Academy puts a real estate deal marketplace in your pocket. Browse live opportunities across multifamily, self-storage, industrial, hospitality, and more — then actually learn how to evaluate them.

Here's what you get:

- A deal marketplace updated weekly with live investment opportunities
- Side-by-side comparisons so you can spot the best risk-adjusted returns in seconds
- Sponsor profiles with track records, AUM, and portfolio history — so you know who you're betting on before you wire money
- A Buy Box that filters deals to YOUR criteria — asset class, target returns, check size, deal structure
- Portfolio tracking from discovery to funded, so nothing falls through the cracks

Built by an LP who's personally deployed $3.3M across 23+ deals since 2019. This isn't theory. It's the tool I wished I had when I started.

Free to browse. Request access to get started.
```

**What's New:**
```
Welcome to Cashflow Academy! This is our first release bringing the full deal marketplace experience to iOS, including:
- Real estate investment deal marketplace
- Buy Box investment preference wizard
- Portfolio tracking with deal stages
- Sponsor and operator profiles
- Property data and analytics
- Push notifications for new deals
- Dark mode support
```

**Review Contact:**
- Pascal Wagner
- pascal@growyourcashflow.io

**Demo Account for Apple Review:**
- Email: test@test.com
- Password: test

**Notes for Reviewer:**
```
Cashflow Academy is a real estate investment deal marketplace. The app loads content from our web platform at dealflow-puce.vercel.app via Capacitor. Users can browse deals, set investment preferences, and track their portfolio.

To test the app:
1. Log in with the demo account above
2. Browse the deal marketplace on the home screen
3. Tap any deal card to see full details
4. Try the Buy Box wizard in the sidebar to set investment preferences
5. Use the portfolio section to track deal stages

The app requires an internet connection as deal data is fetched in real time from our servers.
```

### Step 6: Take and Upload Screenshots

Need screenshots for iPhone 6.7" (1290x2796) and iPhone 6.5" (1284x2778).

Use the iOS Simulator:
```bash
# Boot simulator
xcrun simctl boot "iPhone 17 Pro Max"

# Build and install (if needed)
cd /Users/pascalwagner/Documents/New\ project/dealflow/dealflow
LANG=en_US.UTF-8 xcodebuild -workspace ios/App/App.xcworkspace -scheme App \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' build
xcrun simctl install booted /Users/openclaw/Library/Developer/Xcode/DerivedData/App-*/Build/Products/Debug-iphonesimulator/App.app

# To auto-login, temporarily change capacitor.config.ts server URL to:
# https://dealflow-puce.vercel.app/deal-login.html?autoLogin=test@test.com
# Then rebuild and install. REMEMBER TO REVERT BEFORE ARCHIVING FOR APP STORE.

# Take screenshots
xcrun simctl io booted screenshot /tmp/screenshot_1.png
```

Capture 5 screens:
1. Login page
2. Deal marketplace (feed view)
3. Deal detail page
4. Buy Box wizard
5. Sponsor/Investment Manager profile

### Step 7: Submit for Review

In App Store Connect:
1. Select the uploaded build
2. Attach all screenshots
3. Fill in all metadata fields
4. Click "Submit for Review"

---

## Scheduled Task Setup

To set up an hourly check that automatically completes the submission:

```
Ask Claude: "Read /Users/pascalwagner/Documents/New project/dealflow/APP_STORE_SUBMISSION_GUIDE.md and set up a scheduled task that checks every hour if App Store Connect is accessible, and if so, completes the full submission following all the steps in that guide. The goal is to get Cashflow Academy published on the App Store."
```

---

## Troubleshooting

**App Store Connect says "invalidUser":**
- Account provisioning takes 1-48 hours for new enrollments
- Check https://developer.apple.com/account for membership status
- If payment failed, retry at https://developer.apple.com/enroll/

**"Cannot determine Apple ID from Bundle ID":**
- The app hasn't been created in App Store Connect yet
- Create it first (Step 3), then upload

**Archive fails with "requires development team":**
- DEVELOPMENT_TEAM = XQ875KQN2R must be in project.pbxproj
- Already set in both Debug and Release configurations

**Export fails with "credentials error":**
- Use the local export method (destination=export) then upload with altool
- Don't use destination=upload in ExportOptions.plist

**CocoaPods UTF-8 error:**
- Prefix commands with: LANG=en_US.UTF-8
