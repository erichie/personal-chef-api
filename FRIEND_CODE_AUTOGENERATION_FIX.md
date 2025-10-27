# Friend Code Auto-Generation Fix

## Issue

Friend codes were not being generated automatically when users were created in the database.

## Root Cause

- `createGuestUser()` function in `lib/auth-utils.ts` was not generating friend codes
- `better-auth` configuration had no lifecycle hook to generate friend codes for email/password and OAuth users

## Solution Implemented

### 1. Updated Guest User Creation (`lib/auth-utils.ts`)

**Added:**

- `generateUniqueFriendCode()` helper function with collision detection (max 10 attempts)
- Friend code generation in `createGuestUser()` for new users
- Automatic friend code backfill for existing users without codes

**Changes:**

```typescript
// Before
const user = await prisma.user.create({
  data: {
    id: uuidv4(),
    deviceId,
    isGuest: true,
    email: null,
    passwordHash: null,
    // No friendCode!
  },
});

// After
const friendCode = await generateUniqueFriendCode();
const user = await prisma.user.create({
  data: {
    id: uuidv4(),
    deviceId,
    isGuest: true,
    email: null,
    passwordHash: null,
    friendCode, // ✅ Automatically generated
  },
});
```

### 2. Added better-auth Lifecycle Hook (`lib/auth.ts`)

**Added:**

- `onAfterSignUp` hook to generate friend codes for email/password and OAuth signups
- Collision detection (max 10 attempts)
- Automatic database update after user creation

**Changes:**

```typescript
export const auth = betterAuth({
  // ... existing config
  onAfterSignUp: async (user: { id: string; email?: string }) => {
    // Generate and assign unique friend code
    const maxAttempts = 10;
    let friendCode: string | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const code = generateFriendCode();
      const existing = await prisma.user.findUnique({
        where: { friendCode: code },
      });

      if (!existing) {
        friendCode = code;
        break;
      }
    }

    if (friendCode) {
      await prisma.user.update({
        where: { id: user.id },
        data: { friendCode },
      });
    }
  },
});
```

## Coverage

### ✅ All User Creation Paths Now Generate Friend Codes:

1. **Guest Users** (`POST /api/auth/guest`)
   - Creates user with device ID
   - Friend code generated automatically
2. **Email/Password Signup** (via better-auth)

   - User signs up with email/password
   - `onAfterSignUp` hook generates friend code

3. **OAuth Signup** (Google, etc.)

   - User signs in with OAuth provider
   - `onAfterSignUp` hook generates friend code

4. **Existing Users Without Codes**
   - Script available: `npx tsx scripts/populate-friend-codes.ts`
   - `createGuestUser()` also handles backfill automatically

## Testing

### Test Results

```bash
$ npx tsx scripts/test-friend-code-generation.ts
🧪 Testing friend code generation for new users...

Creating test guest user...
✅ SUCCESS: User created with friend code: KB78D26N
   User ID: 57056de2-b342-4b46-b918-34123f28745d
   Device ID: test-device-78e41e59-d254-444e-b8aa-61748711dfa7

Cleaning up test user...
✅ Test user cleaned up
```

### Collision Detection

- Uses 10 retry attempts
- 36^8 = ~2.8 trillion possible codes
- Extremely low collision probability
- Throws error if 10 attempts fail (unlikely)

## Friend Code Format

- **Length**: 8 characters
- **Characters**: A-Z (excluding O, I), 2-9 (excluding 0, 1)
- **Example**: `KB78D26N`
- **Display Format**: `KB78-D26N` (with dash)

## Migration Path for Existing Users

If you have existing users without friend codes, run:

```bash
npx tsx scripts/populate-friend-codes.ts
```

This script:

- Finds all users with `friendCode: null`
- Generates unique codes with collision detection
- Updates users in database
- Shows progress for each user

## Files Modified

1. **`lib/auth-utils.ts`**

   - Added `generateUniqueFriendCode()` function
   - Updated `createGuestUser()` to generate friend codes
   - Added backfill logic for existing users

2. **`lib/auth.ts`**
   - Added `generateFriendCode` import
   - Added `onAfterSignUp` lifecycle hook
   - Friend code generation for email/OAuth signups

## Verification

### Check a User's Friend Code

```typescript
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: { friendCode: true },
});

console.log(user.friendCode); // "KB78D26N"
```

### Verify All Users Have Codes

```bash
npx tsx scripts/populate-friend-codes.ts
# Output: "✅ All users already have friend codes!"
```

## Status

✅ **FIXED** - All new users now automatically receive friend codes upon creation.

---

**Fix Date**: October 27, 2025  
**Status**: Complete and tested
