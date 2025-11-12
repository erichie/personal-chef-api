# Chat Chef Endpoint

## Overview

The `/api/ai/chat-chef` endpoint provides a conversational AI assistant for users to ask cooking questions, get recipe advice, and receive personalized culinary guidance based on their current context (inventory, meal plan, preferences).

## Endpoint Details

**URL:** `POST /api/ai/chat-chef`

**Authentication:** Required (Bearer token)

## Request Body

```typescript
{
  context?: {
    groceryList?: Array<any>;    // User's shopping list
    inventory?: Array<any>;       // Available ingredients
    mealPlan?: any;               // Current meal plan
    preferences?: {
      dietStyle?: string;
      allergies?: string[];
      exclusions?: string[];
      // ... other preferences
    };
  };
  messages: Array<{
    role: "user" | "assistant" | "system";
    content: string;
  }>;
  tokensToUse?: number;           // Optional: Use tokens to bypass limits
}
```

## Response Format

```typescript
{
  response: string; // AI's reply
  usedTokens: boolean; // Whether tokens were used
  tokensUsed: number; // Amount of tokens used (0 or MEAL_PLAN_TOKEN_COST)
  message: string; // Status message
}
```

## Features

### Context-Aware Responses

The AI assistant has access to:

1. **Inventory** - Knows what ingredients the user has available

   - "What can I make with chicken and rice?"
   - "I have eggs expiring soon, what should I cook?"

2. **Grocery List** - Aware of what they're planning to buy

   - "Should I add anything else to my list?"
   - "Can you suggest recipes for my groceries?"

3. **Meal Plan** - Understands their current meal schedule

   - "What's for dinner tonight?"
   - "Can you help modify my meal plan?"

4. **Dietary Preferences** - Respects restrictions and preferences
   - Allergies are automatically considered
   - Dietary style (vegetarian, vegan, etc.) is applied
   - Exclusions are avoided

### System Prompt

The AI is prompted to:

- Be friendly, encouraging, and enthusiastic about cooking
- Provide practical, actionable advice
- Keep responses concise but informative
- Suggest substitutions when needed
- Help users make the most of available ingredients

## Usage Limits

**Free Users:**

- 3 chat requests (lifetime)
- Can bypass with tokens (25 tokens per request)

**Pro Users:**

- Unlimited chat requests

## Example Requests

### Basic Question

```bash
curl -X POST http://localhost:3000/api/ai/chat-chef \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "How do I make pasta carbonara?"
      }
    ]
  }'
```

### With Context

```bash
curl -X POST http://localhost:3000/api/ai/chat-chef \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "context": {
      "inventory": [
        { "name": "eggs" },
        { "name": "bacon" },
        { "name": "parmesan cheese" }
      ],
      "preferences": {
        "allergies": ["shellfish"]
      }
    },
    "messages": [
      {
        "role": "user",
        "content": "What can I make for dinner?"
      }
    ]
  }'
```

### Conversation with History

```bash
curl -X POST http://localhost:3000/api/ai/chat-chef \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "What can I make with chicken?"
      },
      {
        "role": "assistant",
        "content": "You could make grilled chicken, chicken curry, or chicken stir-fry..."
      },
      {
        "role": "user",
        "content": "Tell me more about the curry option"
      }
    ]
  }'
```

### Using Tokens to Bypass Limits

```bash
curl -X POST http://localhost:3000/api/ai/chat-chef \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tokensToUse": 25,
    "messages": [
      {
        "role": "user",
        "content": "Help me plan this week's meals"
      }
    ]
  }'
```

## Response Examples

### Success Response

```json
{
  "response": "Great question! Pasta carbonara is a classic Italian dish. You'll need: spaghetti, eggs, parmesan, bacon (or pancetta), and black pepper. The key is to mix the hot pasta with the egg mixture off the heat to create a creamy sauce without scrambling the eggs. Would you like the detailed steps?",
  "usedTokens": false,
  "tokensUsed": 0,
  "message": "Response generated successfully"
}
```

### Context-Aware Response

```json
{
  "response": "Perfect! With your eggs, bacon, and parmesan cheese, you can make a delicious carbonara! Since you have all the key ingredients, you just need some pasta. I can walk you through the recipe step by step if you'd like.",
  "usedTokens": false,
  "tokensUsed": 0,
  "message": "Response generated successfully"
}
```

### Limit Exceeded

```json
{
  "error": "Chat chef limit reached",
  "code": "LIMIT_EXCEEDED",
  "details": {
    "limit": 3,
    "used": 3,
    "remaining": 0,
    "resetsAt": null,
    "isLifetime": true,
    "tokenCost": 25
  }
}
```

## Implementation Details

### File Structure

- **Endpoint:** `app/api/ai/chat-chef/route.ts`
- **Usage Tracking:** `lib/ai-usage-utils.ts`
- **AI Client:** `lib/ai-utils.ts`

### Key Functions

**`buildChefSystemPrompt(context)`**

- Builds dynamic system prompt with user context
- Includes inventory, grocery list, meal plan, and preferences
- Limits context size to avoid token overflow

**`checkChatChefLimit(userId)`**

- Checks if user can make chat requests
- Returns usage statistics

**`trackAiUsage(userId, AiEndpoint.CHAT_CHEF)`**

- Records usage for analytics and limits

### AI Configuration

- **Model:** GPT-4o
- **Temperature:** 0.7 (balanced creativity)
- **Max Tokens:** 500 (concise responses)

## Error Handling

| Error Code           | Status | Description                              |
| -------------------- | ------ | ---------------------------------------- |
| INVALID_TOKEN_AMOUNT | 400    | Token amount doesn't match required cost |
| LIMIT_EXCEEDED       | 429    | Free tier limit reached                  |
| UNAUTHORIZED         | 401    | Invalid or missing auth token            |

## Best Practices

1. **Include Context** - Always send relevant context for better responses
2. **Maintain History** - Include previous messages for coherent conversations
3. **Keep Focused** - Ask specific questions for better answers
4. **Limit Context Size** - Large inventories are automatically truncated

## Token Usage

- **Cost:** 25 tokens per request
- **When to Use:** After free tier exhausted
- **Validation:** Token amount must match exactly
- **Deduction:** Handled by mobile app after successful response

## Related Endpoints

- `POST /api/ai/meal-plan` - Generate meal plans
- `POST /api/ai/generate-recipe` - Create single recipes
- `POST /api/ai/replace-recipe` - Find recipe alternatives

## Testing

Run tests with:

```bash
# Test basic chat
curl -X POST http://localhost:3000/api/ai/chat-chef \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"messages":[{"role":"user","content":"Hello!"}]}'

# Test with context
curl -X POST http://localhost:3000/api/ai/chat-chef \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "context":{"inventory":[{"name":"eggs"}]},
    "messages":[{"role":"user","content":"What can I cook?"}]
  }'
```

## Summary

✅ Context-aware conversational AI
✅ Integrates with user's inventory, grocery list, and meal plan
✅ Respects dietary restrictions and preferences
✅ Usage limits and token system
✅ Maintains conversation history
✅ Concise, helpful responses
