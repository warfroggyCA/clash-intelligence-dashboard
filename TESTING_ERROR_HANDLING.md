# 🧪 Testing Error Handling

**Purpose:** How to trigger errors to test the new error handling components

---

## 🎯 Quick Ways to Trigger Errors

### 1. **Network Errors** (Easiest - No Code Changes)

#### Option A: Browser DevTools
1. Open browser DevTools (F12 or Cmd+Option+I)
2. Go to **Network** tab
3. Click **Throttling** dropdown → Select **Offline**
4. Refresh the page or navigate to a new page
5. You'll see: "Connection Problem" error with retry button

#### Option B: Disconnect Internet
1. Disconnect Wi-Fi/Ethernet
2. Refresh the page
3. See network error

#### Option C: Block Network Requests
1. DevTools → **Network** tab
2. Right-click on a request → **Block request URL**
3. Refresh page
4. See network error

---

### 2. **Not Found Errors** (Player Profile)

#### Invalid Player Tag
1. Visit: `http://localhost:5050/player/#INVALID123`
2. Or: `http://localhost:5050/player/#00000000`
3. You'll see: "Not Found" error

#### Non-Existent Player
1. Use a valid tag format but for a player that doesn't exist
2. Example: `http://localhost:5050/player/#ABCDEFGH`
3. See "Not Found" error

---

### 3. **Server Errors** (Requires Temporary Code Change)

#### Method 1: Break API Endpoint Temporarily

**File:** `web-next/src/app/api/v2/roster/route.ts`

Add at the top of the `GET` function:
```typescript
export async function GET(req: NextRequest) {
  // TEMPORARY: Force server error for testing
  return NextResponse.json(
    { success: false, error: 'Test server error' },
    { status: 500 }
  );
  
  // ... rest of code
}
```

Then:
1. Refresh roster page
2. See "Server Error" with retry button
3. Remove the test code when done

---

#### Method 2: Break Player Profile API

**File:** `web-next/src/app/api/player/[tag]/profile/route.ts`

Add at the top:
```typescript
export async function GET(req: NextRequest, { params }: { params: { tag: string } }) {
  // TEMPORARY: Force server error for testing
  return NextResponse.json(
    { success: false, error: 'Test server error' },
    { status: 500 }
  );
  
  // ... rest of code
}
```

---

### 4. **Permission Errors** (If Auth is Implemented)

1. Try accessing a leader-only endpoint as a member
2. Should see "Access Denied" error

---

### 5. **React Component Errors** (Error Boundary)

#### Method 1: Add Temporary Error in Component

**File:** `web-next/src/app/simple-roster/RosterPage.tsx`

Add this somewhere in the component:
```typescript
// TEMPORARY: Force React error for testing
if (Math.random() > 0.99) {
  throw new Error('Test React error');
}
```

#### Method 2: Break a Component

Temporarily break a component by:
```typescript
// Add invalid code that will crash
const broken = undefined.someProperty;
```

---

## 🧪 Testing Checklist

### Network Errors ✅
- [ ] Trigger offline mode
- [ ] See "Connection Problem" message
- [ ] Retry button works
- [ ] Automatic retry happens (check console)

### Server Errors ✅
- [ ] Trigger 500 error
- [ ] See "Server Error" message
- [ ] Retry button works
- [ ] Error message is user-friendly

### Not Found Errors ✅
- [ ] Use invalid player tag
- [ ] See "Not Found" message
- [ ] Go Back button works
- [ ] Go Home button works

### Error Boundary ✅
- [ ] Trigger React component error
- [ ] See error boundary catch it
- [ ] Error display shows correctly
- [ ] Retry resets component

### Retry Logic ✅
- [ ] Network error retries automatically (3 times)
- [ ] Console shows retry attempts
- [ ] Exponential backoff works (delays increase)
- [ ] Non-retryable errors don't retry (4xx errors)

---

## 🔍 What to Look For

### Good Signs ✅
- Error messages are user-friendly (not technical)
- Retry buttons actually work
- Error UI matches design system
- Automatic retries happen in background
- Console shows retry attempts

### Bad Signs ❌
- Technical error messages shown to users
- Retry buttons don't work
- Errors crash the entire app
- No automatic retry
- Generic "Something went wrong" everywhere

---

## 🎨 Visual Testing

### Error Display Should Show:
1. **Icon**: Alert triangle in red circle
2. **Title**: User-friendly title (e.g., "Connection Problem")
3. **Message**: Clear explanation of what happened
4. **Buttons**: 
   - "Try Again" (if retry available)
   - "Go Back" (if applicable)
   - "Go Home" (if applicable)

### Colors Should Match:
- Red theme for errors
- Consistent with design system
- Good contrast for readability

---

## 🚀 Quick Test Script

Run this in browser console to test different error types:

```javascript
// Test network error
fetch('/api/v2/roster').catch(() => {
  console.log('Network error triggered');
});

// Test server error (if you've added the test code)
fetch('/api/v2/roster').then(r => {
  if (r.status === 500) {
    console.log('Server error triggered');
  }
});

// Test not found
fetch('/api/player/#INVALID/profile').then(r => {
  if (r.status === 404) {
    console.log('Not found error triggered');
  }
});
```

---

## 💡 Pro Tips

1. **Keep DevTools Open**: Watch Network tab to see retry attempts
2. **Check Console**: Retry logic logs attempts
3. **Test Different Scenarios**: Network, server, not found, etc.
4. **Remove Test Code**: Don't forget to remove temporary error code!

---

**Happy Testing!** 🎉

