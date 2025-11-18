  import { createFileRoute } from '@tanstack/react-router'
import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Send, Sparkles, Loader2, MessageSquare, Plus } from 'lucide-react'
import AppLayout from '@/components/app-layout'
import { useAuth } from '@/context/AuthContext'
import TutorService, { type StreamChunk } from '@/services/TutorService'
import { useTutorSessions } from '@/hooks/useTutor'

export const Route = createFileRoute('/__protected/tutor')({
  component: RouteComponent,
})

interface Message {
  id: number
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}

function RouteComponent() {
  const { user } = useAuth()
  const { data: sessions = [], refetch: refetchSessions } = useTutorSessions(user?.id)
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: 'assistant',
      content: "Hello! I'm your AI study tutor. I can help you understand concepts, answer questions, and provide explanations. What would you like to learn about today?"
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [sessionId, setSessionId] = useState<string | undefined>()
  const [isLoading, setIsLoading] = useState(false)
  const [loadingSessionId, setLoadingSessionId] = useState<string | undefined>()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const handleStartNewChat = () => {
    setSessionId(undefined)
    setMessages([
      {
        id: 1,
        role: 'assistant',
        content: "Hello! I'm your AI study tutor. I can help you understand concepts, answer questions, and provide explanations. What would you like to learn about today?"
      }
    ])
  }

  const handleLoadSession = async (clickedSessionId: string) => {
    if (!user) return
    setLoadingSessionId(clickedSessionId)
    
    try {
      const sessionData = await TutorService.getChatSession(clickedSessionId, user.id)
      
      // Convert session messages to our Message interface
      const loadedMessages: Message[] = sessionData.messages.map((msg, idx) => ({
        id: idx + 1,
        role: msg.role,
        content: msg.content,
        isStreaming: false
      }))
      
      setMessages(loadedMessages)
      setSessionId(clickedSessionId)
    } catch (error) {
      console.error('Error loading session:', error)
      alert('Failed to load chat session. Please try again.')
    } finally {
      setLoadingSessionId(undefined)
    }
  }

  const formatMessageContent = (text: string) => {
    // Split text into lines
    const lines = text.split('\n')
    const elements: React.ReactNode[] = []
    let i = 0
    
    while (i < lines.length) {
      const trimmedLine = lines[i].trim()
      
      // Check if this is a table row (contains |)
      if (trimmedLine.includes('|')) {
        const tableLines: string[] = []
        let tableStartIndex = i
        
        // Collect all consecutive table lines
        while (i < lines.length && lines[i].trim().includes('|')) {
          tableLines.push(lines[i].trim())
          i++
        }
        
        // Parse and render table
        if (tableLines.length > 0) {
          const table = parseTable(tableLines, tableStartIndex)
          if (table) {
            elements.push(table)
          }
        }
        continue
      }
      
      // Check if line is a bullet point (starts with *, -, or •)
      if (trimmedLine.match(/^[*\-•]\s+(.+)/)) {
        const bulletText = trimmedLine.replace(/^[*\-•]\s+/, '')
        elements.push(
          <li key={`bullet-${i}`} className="ml-4 list-disc">
            {cleanBulletText(bulletText)}
          </li>
        )
      } else if (trimmedLine) {
        // Regular text line
        // Clean markdown formatting
        let cleanText = trimmedLine
          .replace(/\*\*\*/g, '') // Remove triple asterisks
          .replace(/\*\*/g, '') // Remove double asterisks (bold)
          .replace(/\*/g, '') // Remove single asterisks (italic)
          .replace(/`/g, '') // Remove backticks
          .replace(/^#+\s/g, '') // Remove headers
        
        elements.push(
          <p key={`text-${i}`} className="mb-2">
            {cleanText}
          </p>
        )
      }
      
      i++
    }
    
    return <div className="text-left">{elements}</div>
  }

  const cleanBulletText = (text: string): string => {
    return text
      .replace(/\*\*\*/g, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/`/g, '')
  }

  const parseTable = (tableLines: string[], startIndex: number) => {
    // Filter out empty lines and separator lines (lines with only |, -, and spaces)
    const validLines = tableLines.filter(line => {
      const cleaned = line.replace(/\|/g, '').replace(/-/g, '').replace(/:/g, '').trim()
      return cleaned.length > 0
    })
    
    if (validLines.length === 0) return null
    
    // Parse header row
    const headerRow = validLines[0]
    const headers = headerRow
      .split('|')
      .map(cell => cell.trim())
      .filter(cell => cell.length > 0)
      .map(cell => cell.replace(/\*\*/g, '').replace(/\*/g, ''))
    
    // Parse data rows (skip header)
    const dataRows = validLines.slice(1).map(line => 
      line
        .split('|')
        .map(cell => cell.trim())
        .filter(cell => cell.length > 0)
        .map(cell => cell.replace(/\*\*/g, '').replace(/\*/g, ''))
    )
    
    return (
      <div key={`table-${startIndex}`} className="my-4 overflow-x-auto">
        <table className="min-w-full border-collapse border border-border rounded-lg">
          <thead className="bg-muted">
            <tr>
              {headers.map((header, idx) => (
                <th
                  key={`header-${idx}`}
                  className="border border-border px-4 py-2 text-left font-semibold text-sm"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataRows.map((row, rowIdx) => (
              <tr key={`row-${rowIdx}`} className="hover:bg-muted/50">
                {row.map((cell, cellIdx) => (
                  <td
                    key={`cell-${rowIdx}-${cellIdx}`}
                    className="border border-border px-4 py-2 text-sm"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const handleSend = async () => {
    if (!inputValue.trim() || !user || isLoading) return
    
    const userMessage: Message = {
      id: Date.now(),
      role: 'user',
      content: inputValue
    }
    
    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    const aiMessageId = Date.now() + 1
    const aiMessage: Message = {
      id: aiMessageId,
      role: 'assistant',
      content: '',
      isStreaming: true
    }
    setMessages(prev => [...prev, aiMessage])

    try {
      await TutorService.sendMessageStream(
        inputValue,
        user.id,
        (chunk: StreamChunk) => {
          if (chunk.type === 'session' && chunk.sessionId) {
            setSessionId(chunk.sessionId)
            refetchSessions() // Refresh session list when new session is created
          } else if (chunk.type === 'chunk' && chunk.content) {
            setMessages(prev => 
              prev.map(msg => 
                msg.id === aiMessageId 
                  ? { ...msg, content: msg.content + chunk.content }
                  : msg
              )
            )
          } else if (chunk.type === 'done') {
            setMessages(prev => 
              prev.map(msg => 
                msg.id === aiMessageId 
                  ? { ...msg, isStreaming: false }
                  : msg
              )
            )
          } else if (chunk.type === 'error') {
            console.error('Streaming error:', chunk.error)
            setMessages(prev => 
              prev.map(msg => 
                msg.id === aiMessageId 
                  ? { 
                      ...msg, 
                      content: 'Sorry, I encountered an error. Please try again.',
                      isStreaming: false 
                    }
                  : msg
              )
            )
          }
        },
        sessionId,
        undefined // No noteId - use Gemini's general knowledge
      )
    } catch (error) {
      console.error('Error sending message:', error)
      setMessages(prev => 
        prev.map(msg => 
          msg.id === aiMessageId 
            ? { 
                ...msg, 
                content: 'Sorry, I encountered an error. Please try again.',
                isStreaming: false 
              }
            : msg
        )
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AppLayout>
      <div className="h-[calc(100vh-8rem)] flex gap-6 mt-5">
        {/* Chat History Sidebar */}
        <div className="w-80 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Chat History</CardTitle>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="gap-2"
                  onClick={handleStartNewChat}
                >
                  <Plus className="h-4 w-4" />
                  New
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[calc(100vh-16rem)]">
                <div className="space-y-2 pr-4">
                  {sessions.length === 0 ? (
                    <div className="text-center py-8">
                      <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                      <p className="text-sm text-muted-foreground mb-2">No chat history yet</p>
                      <p className="text-xs text-muted-foreground">
                        Start a conversation to see your history
                      </p>
                    </div>
                  ) : (
                    sessions.map((session) => (
                      <div
                        key={session.id}
                        onClick={() => handleLoadSession(session.id)}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          sessionId === session.id
                            ? 'bg-primary/10 border-primary'
                            : 'bg-card hover:bg-accent/50'
                        } ${loadingSessionId === session.id ? 'opacity-50' : ''}`}
                      >
                        <div className="flex items-start gap-2">
                          {loadingSessionId === session.id ? (
                            <Loader2 className="h-4 w-4 mt-0.5 shrink-0 animate-spin" />
                          ) : (
                            <MessageSquare className="h-4 w-4 mt-0.5 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{session.title}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(session.updatedAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Main Chat Area */}
        <Card className="flex-1 flex flex-col bg-muted/30 overflow-hidden">
          <CardHeader className="border-b bg-background/50 shrink-0">
            <CardTitle>AI Tutor</CardTitle>
            <CardDescription>Get personalized help with your studies</CardDescription>
          </CardHeader>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-4" style={{ maxHeight: 'calc(100vh - 24rem)' }}>
            {messages.map((message) => (
              <div 
                key={message.id}
                className="flex gap-3 items-start animate-in fade-in slide-in-from-bottom-2 duration-300"
              >
                {message.role === 'assistant' && (
                  <Avatar className="h-10 w-10 shrink-0 bg-primary">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <Sparkles className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                )}
                
                {message.role === 'user' && (
                  <div className="flex-1" />
                )}
                
                <div className={`max-w-[70%] ${message.role === 'user' ? 'ml-auto' : ''}`}>
                  <div 
                    className={`rounded-lg px-4 py-3 transition-all duration-200 ${
                      message.role === 'user' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted border'
                    }`}
                  >
                    {message.isStreaming && message.content === '' ? (
                      <div className="flex items-center gap-2 py-2">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span className="text-sm text-muted-foreground">AI is thinking...</span>
                      </div>
                    ) : (
                      <div className="text-sm leading-relaxed text-left">
                        {message.role === 'user' ? (
                          <p className="whitespace-pre-wrap">{message.content}</p>
                        ) : (
                          formatMessageContent(message.content)
                        )}
                        {message.isStreaming && message.content !== '' && (
                          <span className="inline-block w-1 h-4 bg-current ml-1 animate-pulse" />
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {message.role === 'user' && (
                  <Avatar className="h-10 w-10 shrink-0 bg-muted border">
                    <AvatarFallback className="bg-muted text-foreground font-medium text-xs">
                      You
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}
            <div ref={scrollRef} />
          </div>

          <div className="p-6 border-t bg-background/50 shrink-0">
            <div className="flex gap-3">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder="Ask me anything..."
                className="flex-1 h-12 px-4 text-base bg-background"
                disabled={isLoading}
              />
              <Button 
                onClick={handleSend}
                size="lg"
                className="h-12 px-6 gap-2"
                disabled={!inputValue.trim() || isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="hidden sm:inline">Thinking...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span className="hidden sm:inline">Send</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </AppLayout>
  )
}
