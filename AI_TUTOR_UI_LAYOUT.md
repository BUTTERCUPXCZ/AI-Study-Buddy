# AI Tutor - New UI Layout

## Visual Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│  APP LAYOUT (Header with Navigation)                                │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────────┬──────────────────────────────────────────────┐
│  CHAT HISTORY        │  MAIN CHAT AREA                              │
│  (Sidebar - 320px)   │  (Flex-1 - Remaining width)                  │
├──────────────────────┼──────────────────────────────────────────────┤
│                      │                                              │
│  ┌────────────────┐  │  ┌────────────────────────────────────────┐ │
│  │ Chat History   │  │  │ AI Tutor                               │ │
│  │           [New]│  │  │ Get personalized help with your studies│ │
│  └────────────────┘  │  └────────────────────────────────────────┘ │
│                      │                                              │
│  ┌────────────────┐  │  ┌────────────────────────────────────────┐ │
│  │ 💬 Session 1   │  │  │                                        │ │
│  │ Nov 18, 2025   │  │  │   🤖  Hello! I'm your AI study tutor  │ │
│  └────────────────┘  │  │                                        │ │
│                      │  │                                        │ │
│  ┌────────────────┐  │  │               What is Python? [You] 👤│ │
│  │ 💬 Session 2   │  │  │                                        │ │
│  │ Nov 17, 2025   │  │  │   🤖  Python is a high-level...       │ │
│  └────────────────┘  │  │                                        │ │
│                      │  │                                        │ │
│  ┌────────────────┐  │  │       [Streaming response...]         │ │
│  │ 💬 Session 3   │  │  │                                        │ │
│  │ Nov 15, 2025   │  │  └────────────────────────────────────────┘ │
│  └────────────────┘  │                                              │
│                      │  ┌────────────────────────────────────────┐ │
│  (Scrollable list)   │  │ Ask me anything... [Send]              │ │
│                      │  └────────────────────────────────────────┘ │
│                      │                                              │
└──────────────────────┴──────────────────────────────────────────────┘
```

## Component Breakdown

### Left Sidebar (Chat History)
```tsx
<Card>
  <CardHeader>
    <CardTitle>Chat History</CardTitle>
    <Button>New</Button>
  </CardHeader>
  <CardContent>
    <ScrollArea>
      {sessions.map(session => (
        <SessionCard 
          title={session.title}
          date={session.updatedAt}
          active={sessionId === session.id}
          onClick={loadSession}
        />
      ))}
    </ScrollArea>
  </CardContent>
</Card>
```

### Right Chat Area
```tsx
<Card>
  <CardHeader>
    <CardTitle>AI Tutor</CardTitle>
    <CardDescription>Get personalized help</CardDescription>
  </CardHeader>
  
  {/* Messages Area - Scrollable */}
  <div className="flex-1 overflow-y-auto">
    {messages.map(message => (
      <MessageBubble 
        role={message.role}
        content={message.content}
        streaming={message.isStreaming}
      />
    ))}
  </div>
  
  {/* Input Area - Fixed Bottom */}
  <div className="border-t">
    <Input placeholder="Ask me anything..." />
    <Button>Send</Button>
  </div>
</Card>
```

## Color Scheme

### Session States:
- **Normal**: `bg-card hover:bg-accent/50`
- **Active**: `bg-primary/10 border-primary`
- **Loading**: `opacity-50` with spinner

### Message Bubbles:
- **User**: `bg-primary text-primary-foreground` (Right aligned)
- **AI**: `bg-muted border` (Left aligned)

### Buttons:
- **New Chat**: `variant="outline"` with Plus icon
- **Send**: Primary button with Send icon

## Responsive Behavior

### Desktop (> 1024px):
- Sidebar: 320px fixed width
- Chat: Flex-grow to fill remaining space
- Full layout as shown above

### Tablet (768px - 1024px):
- Sidebar: 280px width
- Chat: Remaining space
- Same two-column layout

### Mobile (< 768px):
- Could be enhanced with a drawer/modal for session history
- Full-width chat interface
- Toggle button to show/hide sessions

## Key Interactive Elements

### Click Actions:
1. **New Chat Button** → `handleStartNewChat()`
2. **Session Card** → `handleLoadSession(sessionId)`
3. **Send Button** → `handleSend()`
4. **Enter Key** → `handleSend()` (Shift+Enter for new line)

### Loading States:
1. **Session Loading** → Spinner on specific session card
2. **AI Thinking** → "AI is thinking..." message with spinner
3. **Streaming** → Pulsing cursor at end of text

### Visual Feedback:
1. **Active Session** → Primary color border and background tint
2. **Hover States** → Subtle background color change
3. **Animations** → Fade-in and slide-in for new messages

## Comparison: Before vs After

### BEFORE:
```
┌────────────────────┬──────────────────────┐
│ Learning Materials │  Chat Interface      │
│ (PDF Selection)    │                      │
│ ☑️ Note 1          │  Messages            │
│ ☐ Note 2          │                      │
│ ☑️ Note 3          │  [Input]             │
└────────────────────┴──────────────────────┘
```

### AFTER:
```
┌────────────────────┬──────────────────────┐
│ Chat History       │  Chat Interface      │
│ (Session List)     │                      │
│ 💬 Session 1       │  Messages            │
│ 💬 Session 2       │                      │
│ 💬 Session 3       │  [Input]             │
└────────────────────┴──────────────────────┘
```

## User Benefits

✅ **Familiar Pattern**: Matches ChatGPT, Gemini, and other AI chat UIs
✅ **Easy Navigation**: Quick access to all previous conversations
✅ **Clear Organization**: Each session is a separate conversation thread
✅ **No Prerequisites**: No need to upload materials first
✅ **Instant Access**: Start chatting immediately
✅ **Full AI Knowledge**: Powered by Gemini's complete knowledge base
