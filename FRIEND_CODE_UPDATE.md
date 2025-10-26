# Friend Code Format Update

## Overview

Updated friend codes from long CUID2 format (25+ characters) to short, user-friendly 8-character alphanumeric codes.

## Changes

### Before

```
Friend Code: clhvz6y7z0000qzrm8z7z7z7z
```

### After

```
Friend Code: ABC12XYZ
Display Format: ABC1-2XYZ (with optional dash for readability)
```

## New Format Specifications

- **Length:** 8 characters
- **Character Set:** Uppercase letters (A-Z) + digits (2-9)
  - Excluded confusing characters: `0`, `O`, `1`, `I`
- **Total Combinations:** 30^8 = ~656 billion possible codes
- **Collision Probability:** Extremely low (plenty of codes for millions of users)

## Files Created/Modified

### New File

- `lib/friend-code-generator.ts` - Friend code generation and formatting utilities
  - `generateFriendCode()` - Generates 8-character code
  - `formatFriendCode()` - Formats as `XXXX-XXXX` for display
  - `normalizeFriendCode()` - Removes dashes/spaces, converts to uppercase

### Updated Files

1. **scripts/populate-friend-codes.ts**

   - Now uses `generateFriendCode()` instead of CUID2
   - Includes collision detection (retries up to 10 times)
   - Displays codes in formatted form

2. **lib/friend-utils.ts**
   - Updated `findUserByFriendCode()` to normalize input before lookup
   - Users can now enter codes with or without dashes, any case

## User Experience Improvements

### Easy to Share

✅ Short codes are easy to share verbally
✅ Easy to type on mobile devices
✅ Can be written down quickly

### Flexible Input

Users can enter codes in any of these formats:

- `ABC12XYZ` (raw format)
- `ABC1-2XYZ` (formatted)
- `abc12xyz` (lowercase - auto-normalized)
- `ABC1 2XYZ` (with spaces - auto-normalized)

### Display Format

The code can be displayed with a dash for easier reading:

```typescript
import { formatFriendCode } from "@/lib/friend-code-generator";

const code = "ABC12XYZ";
const display = formatFriendCode(code); // "ABC1-2XYZ"
```

## Migration Strategy

### For Existing Users

If you have existing users with long CUID2 friend codes:

**Option 1: Keep Existing Codes (Backward Compatible)**

- Old codes still work
- New users get short codes
- Gradually transition as users update profiles

**Option 2: Regenerate All Codes**

```bash
# 1. Clear all existing friend codes
npx prisma studio
# Delete all friendCode values

# 2. Run the populate script
npx tsx scripts/populate-friend-codes.ts

# All users get new 8-character codes
```

### For New Users

New users will automatically get the 8-character friend codes when they:

- Create an account
- Sign in as a guest

## Database Schema

No schema changes needed! The `friendCode` field is already:

```prisma
friendCode   String?  @unique
```

Works with codes of any length.

## API Compatibility

All existing endpoints remain unchanged:

- `POST /api/friends/find-by-code` - Works with normalized input
- `POST /api/friends/send-request` - Works with any format
- `GET /api/friends` - Returns codes in stored format

## Testing

```bash
# Test code generation
npx tsx -e "
import { generateFriendCode, formatFriendCode } from './lib/friend-code-generator.ts';
const code = generateFriendCode();
console.log('Generated:', code);
console.log('Formatted:', formatFriendCode(code));
"

# Test normalization
npx tsx -e "
import { normalizeFriendCode } from './lib/friend-code-generator.ts';
console.log(normalizeFriendCode('ABC1-2XYZ'));  // ABC12XYZ
console.log(normalizeFriendCode('abc1 2xyz'));  // ABC12XYZ
"
```

## Example Usage

### Generate a Code

```typescript
import { generateFriendCode } from "@/lib/friend-code-generator";

const friendCode = generateFriendCode();
// Returns: "ABC12XYZ"
```

### Format for Display

```typescript
import { formatFriendCode } from "@/lib/friend-code-generator";

const display = formatFriendCode("ABC12XYZ");
// Returns: "ABC1-2XYZ"
```

### Handle User Input

```typescript
import { normalizeFriendCode } from "@/lib/friend-code-generator";

const userInput = "abc1-2xyz";
const normalized = normalizeFriendCode(userInput);
// Returns: "ABC12XYZ"

// Now search with normalized code
const user = await findUserByFriendCode(normalized);
```

## Security Considerations

### Brute Force Protection

With 656 billion possible codes, brute force attacks are not practical:

- Random guessing has ~0.00000000015% chance per attempt
- Should still implement rate limiting on friend code lookups

### Recommended Rate Limits

- Friend code lookups: 10 attempts per minute per IP
- Friend request sends: 20 per hour per user

## Benefits Summary

✅ **User-Friendly:** Easy to share, type, and remember
✅ **Flexible:** Accepts multiple input formats
✅ **Secure:** 656 billion possible combinations
✅ **Backward Compatible:** Works with existing schema
✅ **Display-Friendly:** Optional formatting with dash
✅ **Error-Resistant:** Excludes confusing characters (0, O, 1, I)

## Status

✅ **Implementation Complete**
✅ **Build Successful**
✅ **Ready for Deployment**

---

**Updated:** October 26, 2025
**Status:** Production Ready 🚀
