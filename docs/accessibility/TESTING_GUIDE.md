# Accessibility Testing Guide
## How to Verify the Audit Report & Test Your Fixes

This guide shows you exactly how to test your Clash Intelligence Dashboard for the accessibility issues identified in the audit.

---

## 🚀 Quick Start - 5 Minute Test

### Test 1: Automated Lighthouse Audit (2 minutes)

**In Chrome/Edge:**
1. Open your site: https://heckyeah.clashintelligence.com
2. Right-click anywhere → **Inspect** (or press F12)
3. Click **Lighthouse** tab (top navigation)
4. Check only ✅ **Accessibility**
5. Select **Desktop** or **Mobile**
6. Click **Analyze page load**

**What to Look For:**
- Current score (likely 60-80)
- Red/Orange issues in the report
- Compare with audit report issues

**Expected Results:**
```
Current Score: ~70
After Critical Fixes: ~85
After All Fixes: 95+
```

---

### Test 2: Color Contrast Check (1 minute)

**Using Browser Extension:**
1. Install [axe DevTools](https://chrome.google.com/webstore/detail/axe-devtools-web-accessib/lhdoppojpmngadmnindnejefpokejbdd) (Chrome/Edge)
2. Open your site
3. Open DevTools (F12) → Click **axe DevTools** tab
4. Click **Scan ALL of my page**

**Look for these specific issues:**
- "Elements must have sufficient color contrast" ❌
- Text showing contrast ratios < 4.5:1
- Specifically look for `text-slate-400` and `text-muted` classes

**Screenshot the results** to compare with my findings!

---

### Test 3: Keyboard Navigation (2 minutes)

**Manual Test:**
1. Open your site in a **new incognito window** (ensures clean state)
2. Close your mouse pointer (don't use it!)
3. Press **Tab** repeatedly
4. Check:
   - ❌ Can you see where focus is? (Should have visible blue outline)
   - ❌ Can you reach ALL interactive elements?
   - ❌ Does Tab order make sense (top→bottom, left→right)?
   - ❌ Are any elements skipped?

**Critical Test Points:**
- Tab through navigation buttons (Dashboard, History, Command Center, etc.)
- Tab to "Show Filters" button - press **Enter** - can you reach all filter controls?
- Tab through the roster table - can you reach sort buttons?
- Press **Enter** on player name - does it navigate?

**Expected Issues You'll Find:**
- Focus may be hard to see on some buttons
- Some icon-only buttons may not be reachable
- Tab order might skip important elements

---

## 🛠️ Detailed Testing Tools & Methods

### Tool 1: WAVE Browser Extension (Best for Visual Testing)

**Installation:**
1. Install [WAVE Extension](https://wave.webaim.org/extension/)
2. Visit your site
3. Click WAVE icon in toolbar

**What You'll See:**
- 🔴 **Red Icons** = Errors (accessibility violations)
- 🟡 **Yellow Icons** = Alerts (potential issues)
- 🟢 **Green Icons** = Features (good practices)

**Expected Findings:**
- Red error for missing form labels
- Red errors for low contrast text
- Alerts for missing alt text on icons
- Alerts for missing ARIA labels

**Take Screenshots:**
```
Dashboard page: X errors, Y alerts
Command Center: X errors, Y alerts
Player DB: X errors, Y alerts
```

---

### Tool 2: Color Contrast Analyzer (Precise Testing)

**Online Tool:**
1. Visit [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
2. Test these specific combinations from your site:

**Dark Theme Tests:**
| Foreground | Background | Current Ratio | Pass? |
|------------|-----------|---------------|-------|
| #94A3B8 (text-slate-400) | #0B1220 (dark bg) | ~2.8:1 | ❌ FAIL |
| #64748B (text-slate-500) | #0B1220 (dark bg) | ~2.1:1 | ❌ FAIL |
| #E2E8F0 (text-secondary) | #0B1220 (dark bg) | ~13:1 | ✅ PASS |
| #FFFFFF (text-primary) | #0B1220 (dark bg) | ~18:1 | ✅ PASS |

**How to Find Colors:**
1. Right-click element → Inspect
2. In Styles panel, find `color` property
3. Note the hex/rgba value
4. Find background color of parent element
5. Enter both in WebAIM tool

**Light Theme Tests:**
| Foreground | Background | Should Pass? |
|------------|-----------|--------------|
| #1F2A44 | #FFFFFF | ✅ Should pass |
| #475569 | #F8FAFC | ❌ May fail |
| #0F172A | #FFFFFF | ✅ Should pass |

---

### Tool 3: Screen Reader Testing (Most Important!)

#### **Windows - NVDA (Free)**
1. Download [NVDA](https://www.nvaccess.org/download/)
2. Install and start
3. Open your site
4. Press **Insert + Down Arrow** to start reading

**Test Checklist:**
- [ ] Does NVDA announce page title?
- [ ] Does it read navigation correctly?
- [ ] When tabbing to buttons, does it say button name + "button"?
- [ ] Does it announce "clickable" or "button" for icon-only buttons?
- [ ] In data table, does it announce column headers?
- [ ] Does it announce current sort order?

**Expected Issues:**
- "Button" with no name (unnamed buttons)
- "Clickable graphic" instead of descriptive name
- Table cells without header associations
- No announcement when filters change

#### **Mac - VoiceOver (Built-in)**
1. Press **Cmd + F5** to enable
2. Navigate with **Control + Option + Arrow Keys**
3. Interact with **Control + Option + Space**

**Quick Test:**
- Can you navigate the entire page?
- Are all buttons announced clearly?
- Can you understand what each control does?

#### **Mobile - TalkBack (Android)**
1. Settings → Accessibility → TalkBack → Enable
2. Navigate by swiping right
3. Double-tap to activate

**Test:**
- Are touch targets large enough?
- Can you tap buttons accurately?
- Are gestures working?

---

### Tool 4: Accessibility Insights for Web (Microsoft)

**Installation:**
1. Install [Accessibility Insights](https://chrome.google.com/webstore/detail/accessibility-insights-fo/pbjjkligggfmakdaogkfomddhfmpjeni)
2. Open your site
3. Click extension icon → **FastPass**

**What It Tests:**
- ✅ Automated checks (runs 50+ rules)
- ✅ Tab stops (visual overlay showing tab order)
- ✅ Color contrast (highlights failing elements)

**FastPass Results:**
- Shows exactly which elements fail
- Provides fix recommendations
- Highlights them on the page

---

## 📋 Manual Testing Checklists

### Checklist 1: Keyboard Navigation Tests

Open site and complete WITHOUT using your mouse:

**Navigation Tests:**
- [ ] Tab from browser address bar to first element on page
- [ ] Is first focused element the "Skip to main content" link? (Currently NO ❌)
- [ ] Tab through all navigation items
- [ ] Press Enter on each nav item - does it work?
- [ ] Tab to "Command Center" - press Enter
- [ ] Can you see focus indicator clearly? (Currently: May be faint ❌)

**Interactive Elements:**
- [ ] Tab to "Show Filters" button
- [ ] Press Enter to expand filters
- [ ] Tab through ALL filter controls
- [ ] Can you operate dropdowns with arrow keys?
- [ ] Press Escape - does filter panel close?
- [ ] Tab to search box - type something
- [ ] Can you activate quick filter buttons?

**Table Interaction:**
- [ ] Tab to table area
- [ ] Can you reach column header sort buttons?
- [ ] Press Enter on "Name" column - does it sort?
- [ ] Tab through table rows
- [ ] Can you activate player detail view from keyboard?

**Data Entry:**
- [ ] Tab to search input
- [ ] Type "andrew" - does search work?
- [ ] Can you clear search with keyboard?
- [ ] Tab to role filter
- [ ] Use arrow keys to select option
- [ ] Press Enter to apply

**Score Your Site:**
```
All tests pass: A+ (Perfect keyboard access)
1-2 failures: B (Good, minor issues)
3-5 failures: C (Needs improvement)
6+ failures: F (Major keyboard issues) ← Current state
```

---

### Checklist 2: Screen Reader Announcement Tests

**Using NVDA or VoiceOver:**

**Page Structure:**
- [ ] Reads page title correctly
- [ ] Announces landmarks (navigation, main, etc.)
- [ ] Reads headings in correct hierarchy
- [ ] Announces number of items in lists

**Button Announcements:**
- [ ] "Dashboard button" (not just "button")
- [ ] "Show all 12 alerts button, collapsed" (with state)
- [ ] "Sort by name, ascending button" (with current sort)
- [ ] "View ACE leaderboard button" (descriptive)

**Form Controls:**
- [ ] "Search clan members, edit text" (with label)
- [ ] "Filter by role, combo box" (with label)
- [ ] "Town hall level, 16" (label + value)

**Data Tables:**
- [ ] "Table with 50 rows and 12 columns"
- [ ] Column headers announced when entering cells
- [ ] "Name, column header, sortable"
- [ ] "andrew, row 1, Name column"

**Dynamic Updates:**
- [ ] "Loading clan data" (when refreshing)
- [ ] "Found 5 members matching andrew" (search results)
- [ ] "Sorted by trophies descending" (after sorting)
- [ ] "Page 2 of 5" (pagination change)

**Score:**
```
All tests pass: Screen reader friendly ✅
Missing 1-3 announcements: Needs work ⚠️
Missing 4+ announcements: Not accessible ❌ ← Current state
```

---

### Checklist 3: Touch Target Size Tests (Mobile)

**Using Chrome DevTools Mobile Emulation:**
1. Open DevTools (F12)
2. Click **Toggle device toolbar** (Ctrl+Shift+M)
3. Select "iPhone 12 Pro" or "Pixel 5"
4. Zoom to 100%

**Measure Elements:**
1. Right-click element → Inspect
2. In DevTools, hover over element
3. Check tooltip showing size (e.g., "32 × 28")

**Test These Elements:**

| Element | Current Size | Should Be | Pass? |
|---------|-------------|-----------|-------|
| Quick filter buttons | ~32×28px | 44×44px | ❌ |
| Table sort buttons | ~28×24px | 44×44px | ❌ |
| Expand alert chevron | ~20×20px | 44×44px | ❌ |
| View toggle buttons | ~36×32px | 44×44px | ❌ |
| Search clear button | ~24×24px | 44×44px | ❌ |
| Navigation tabs | ~40×36px | 44×44px | ⚠️ |

**Physical Device Test:**
1. Open site on your phone
2. Try tapping each element
3. Do you frequently miss? → TOO SMALL ❌
4. Do you tap wrong element? → TOO CLOSE ❌

---

### Checklist 4: Color Contrast Tests

**Visual Inspection Test:**
1. Open site in incognito mode
2. Take screenshots of:
   - Dashboard
   - Command Center  
   - Roster table
3. Convert to grayscale (using image editor)
4. Can you still read all text clearly?

**Elements to Check:**

**Dark Theme Issues:**
- Secondary text (role badges, descriptions)
- Metric labels ("ACTIVITY SCORE", "DONATION BALANCE")
- Muted text in tooltips
- Disabled button text
- Table footer text

**Light Theme Issues:**
- Badge backgrounds on white
- Secondary button text
- Muted labels
- Border colors (may be too faint)

**Use This Test:**
1. Right-click text element
2. Inspect → Computed tab
3. Note `color` value
4. Find parent background color
5. Check ratio at webaim.org/resources/contrastchecker/
6. Must be ≥4.5:1 for normal text

---

## 🔬 Advanced Testing

### Test Suite 1: Focus Management

**Test Modal Focus Trap:**
1. Tab to "Settings" button (if available)
2. Press Enter to open modal
3. Keep pressing Tab
4. Does focus stay INSIDE modal? (Should: YES, Currently: Maybe NO ❌)
5. Press Escape
6. Does focus return to Settings button? (Should: YES, Currently: Maybe NO ❌)

### Test Suite 2: ARIA Live Regions

**Test Loading Announcements:**
1. Start screen reader (NVDA/VoiceOver)
2. Click "Refresh Data & Insights" button
3. Does screen reader announce "Loading"? (Currently: NO ❌)
4. When done, does it announce "Loaded 18 members"? (Currently: NO ❌)

**Test Search Results:**
1. Screen reader on
2. Type in search box: "andrew"
3. Does it announce "Found 3 members matching andrew"? (Currently: NO ❌)

**Test Sort Changes:**
1. Screen reader on
2. Click "Name" column header
3. Does it announce "Sorted by name ascending"? (Currently: NO ❌)

### Test Suite 3: Skip Links

**Test Skip Navigation:**
1. Open site
2. Press Tab (should focus skip link)
3. Is skip link visible? (Currently: NO - doesn't exist ❌)
4. Press Enter
5. Should jump to main content

---

## 📊 Create Your Own Test Report

### Before Implementing Fixes:

```
=== ACCESSIBILITY TEST REPORT ===
Date: [Today's date]
URL: https://heckyeah.clashintelligence.com
Tester: [Your name]

AUTOMATED TESTS:
✓ Lighthouse Score: __/100
✓ axe DevTools Issues: __ errors, __ warnings
✓ WAVE Errors: __

MANUAL TESTS:
□ Keyboard Navigation: Pass/Fail
□ Screen Reader: Pass/Fail  
□ Touch Targets: Pass/Fail
□ Color Contrast: Pass/Fail
□ Focus Indicators: Pass/Fail

CRITICAL ISSUES VERIFIED:
□ Missing ARIA labels (Yes/No)
□ Low contrast text (Yes/No)
□ Small touch targets (Yes/No)
□ Missing form labels (Yes/No)
□ No skip link (Yes/No)
□ Table semantics (Yes/No)
□ No loading announcements (Yes/No)

NOTES:
[Add your observations]
```

### After Implementing Fixes:

Run the same tests and compare scores!

```
=== IMPROVEMENT REPORT ===
Lighthouse: 70 → 95 (+25) ✅
axe Issues: 15 → 2 (-13) ✅
WAVE Errors: 23 → 5 (-18) ✅
Keyboard: Fail → Pass ✅
Screen Reader: Fail → Pass ✅
```

---

## 🎯 Priority Testing Order

### Day 1: Quick Validation (30 minutes)
1. Run Lighthouse audit (2 min)
2. Run axe DevTools scan (2 min)
3. Keyboard navigation test (10 min)
4. Color contrast spot check (10 min)
5. Document baseline scores

### Week 1: After Critical Fixes
1. Re-run Lighthouse (should improve to ~85)
2. Re-run axe DevTools (should see fewer errors)
3. Keyboard test (should pass most checks)
4. Color contrast (should pass all checks)

### Week 2: After High Priority Fixes
1. Screen reader testing (30 min)
2. Mobile device testing (20 min)
3. Touch target verification (10 min)
4. All automated tests (10 min)

### Week 3: Final Validation
1. Complete manual test checklist
2. Test with real screen reader users (if possible)
3. Cross-browser testing
4. Mobile testing on multiple devices
5. Create final report

---

## 🐛 Common Testing Mistakes to Avoid

### ❌ Don't Do This:
- Testing only in Chrome (test Safari, Firefox, Edge too)
- Using only automated tools (manual testing is critical)
- Testing with mouse only (must test keyboard)
- Skipping screen reader testing
- Testing on laptop only (must test mobile)
- Testing at 100% zoom only (test 200%, 400%)
- Assuming fixes work without re-testing

### ✅ Do This Instead:
- Test in multiple browsers
- Combine automated + manual testing
- Test keyboard, screen reader, touch
- Test on real mobile devices
- Test at different zoom levels
- Re-test after every fix
- Get feedback from users with disabilities

---

## 📞 Need Help Testing?

### Free Testing Resources:
- **W3C Validator:** validator.w3.org
- **HTML5 Outliner:** gsnedders.html5.org/outliner/
- **Color Contrast:** coolors.co/contrast-checker
- **ARIA Validator:** www.w3.org/WAI/ARIA/apg/

### Community Testing:
- Post on WebAIM mailing list
- Ask for volunteers on A11y Slack communities
- Reddit r/accessibility community

### Professional Testing:
- Hire accessibility consultant
- Use services like AccessiBe or UserWay (automated)
- Contract with disabled user testers

---

## ✅ Final Checklist Before Declaring "Done"

**Required for WCAG 2.1 AA:**
- [ ] Lighthouse accessibility score ≥95
- [ ] axe DevTools: 0 critical errors
- [ ] All text has ≥4.5:1 contrast ratio
- [ ] 100% keyboard accessible
- [ ] All interactive elements have ARIA labels
- [ ] All images have alt text
- [ ] Forms have proper labels
- [ ] Tables have proper structure
- [ ] Screen reader tested
- [ ] Mobile tested on real device
- [ ] Focus visible on all elements
- [ ] No keyboard traps
- [ ] Touch targets ≥44×44px

**Optional but Recommended:**
- [ ] Tested by actual screen reader users
- [ ] Tested by people with motor disabilities
- [ ] Tested by people with low vision
- [ ] Cross-browser tested
- [ ] Passed JAWS/NVDA/VoiceOver tests
- [ ] Documented for users (accessibility statement)

---

## 🎉 Success Criteria

Your site is accessible when:

✅ **Automated:** 95+ Lighthouse score, 0 axe critical errors  
✅ **Manual:** Passes all keyboard navigation tests  
✅ **Screen Reader:** All content and functions accessible  
✅ **Visual:** All text readable, focus clearly visible  
✅ **Mobile:** All buttons tappable, no horizontal scroll  
✅ **Real Users:** Positive feedback from disabled users  

---

**Remember:** Accessibility testing is ongoing, not one-time. Re-test after each major update!

**Questions?** Review the audit report for specific issues, or ask me to help implement and test fixes!
