  import { createFileRoute } from '@tanstack/react-router'
import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Send, Sparkles, BookOpen, FileText, Loader2 } from 'lucide-react'
import AppLayout from '@/components/app-layout'
import { useAuth } from '@/context/AuthContext'
import { useNotes } from '@/hooks/useNotes'
import TutorService, { type StreamChunk } from '@/services/TutorService'
import type { Note } from '@/services/NotesService'

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
  const { data: notes = [], isLoading: notesLoading } = useNotes(user?.id)
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: 'assistant',
      content: "Hello! I'm your AI study tutor. Select some learning materials from the sidebar, and I can help you understand concepts, answer questions, and provide explanations based on your uploaded PDFs. What would you like to learn about today?"
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([])
  const [sessionId, setSessionId] = useState<string | undefined>()
  const [isLoading, setIsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const handleToggleNote = (noteId: string) => {
    setSelectedNoteIds(prev => 
      prev.includes(noteId) 
        ? prev.filter(id => id !== noteId)
        : [...prev, noteId]
    )
  }

  const cleanMarkdownText = (text: string): string => {
    // Remove asterisks used for bold/italic (**, *, **)
    let cleaned = text.replace(/\*\*\*/g, '') // Remove triple asterisks
    cleaned = cleaned.replace(/\*\*/g, '') // Remove double asterisks (bold)
    cleaned = cleaned.replace(/\*/g, '') // Remove single asterisks (italic)
    
    // Remove other markdown symbols
    cleaned = cleaned.replace(/`/g, '') // Remove backticks
    cleaned = cleaned.replace(/^#+\s/gm, '') // Remove headers (#, ##, etc.)
    
    return cleaned.trim()
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
      const contextNoteId = selectedNoteIds.length > 0 ? selectedNoteIds[0] : undefined

      await TutorService.sendMessageStream(
        inputValue,
        user.id,
        (chunk: StreamChunk) => {
          if (chunk.type === 'session' && chunk.sessionId) {
            setSessionId(chunk.sessionId)
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
        contextNoteId
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
        <div className="w-96 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Your Learning Materials</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Select materials to provide context for the AI tutor
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {notesLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground mt-2">Loading materials...</p>
                </div>
              ) : notes.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-sm text-muted-foreground mb-2">No materials yet</p>
                  <p className="text-xs text-muted-foreground">
                    Upload PDFs from the Notes page to get started
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[calc(100vh-20rem)]">
                  <div className="space-y-2 pr-4">
                    {notes.map((note: Note) => (
                      <div 
                        key={note.id}
                        className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                        onClick={() => handleToggleNote(note.id)}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedNoteIds.includes(note.id)}
                            onCheckedChange={() => handleToggleNote(note.id)}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{note.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-xs">
                                {note.source || 'PDF'}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(note.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {selectedNoteIds.length > 0 && (
            <Card className="border-primary">
              <CardContent className="pt-4">
                <div className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-primary mb-1">Context Active</p>
                    <p className="text-xs text-muted-foreground">
                      The AI will use {selectedNoteIds.length} selected {selectedNoteIds.length === 1 ? 'material' : 'materials'} to answer your questions
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="flex-1 flex flex-col bg-muted/30 overflow-hidden">
          <CardHeader className="border-b bg-background/50 shrink-0">
            <CardTitle>AI Tutor</CardTitle>
            <CardDescription>Get personalized help with your study materials</CardDescription>
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
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {cleanMarkdownText(message.content)}
                        {message.isStreaming && message.content !== '' && (
                          <span className="inline-block w-1 h-4 bg-current ml-1 animate-pulse" />
                        )}
                      </p>
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
                placeholder={
                  selectedNoteIds.length > 0 
                    ? "Ask me anything about your selected materials..."
                    : "Select materials from the sidebar to get started..."
                }
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
            {selectedNoteIds.length === 0 && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                💡 Tip: Select learning materials from the sidebar for more accurate answers
              </p>
            )}
          </div>
        </Card>
      </div>
    </AppLayout>
  )
}
