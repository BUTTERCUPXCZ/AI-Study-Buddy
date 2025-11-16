import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Send, Sparkles, BookOpen, Plus, X, FileText } from 'lucide-react'
import AppLayout from '@/components/app-layout'

export const Route = createFileRoute('/__protected/tutor')({
  component: RouteComponent,
})

interface Message {
  id: number
  role: 'user' | 'assistant'
  content: string
}

interface Material {
  id: number
  name: string
  file: File
  pages: number
}

function RouteComponent() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: 'assistant',
      content: "Hello! I'm your AI study tutor. I can help you understand concepts from your lecture materials, answer questions, and provide explanations. What would you like to learn about today?"
    },
    {
      id: 2,
      role: 'user',
      content: 'Can you explain time complexity to me?'
    },
    {
      id: 3,
      role: 'assistant',
      content: "That's a great question! Let me explain that in detail. Time complexity measures how the runtime of an algorithm grows as the input size increases. For example, if you have an array of n elements and you need to check each one, that's O(n) - linear time. Would you like me to explain any specific complexity class?"
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [materials, setMaterials] = useState<Material[]>([])

  const handleSend = () => {
    if (!inputValue.trim()) return
    
    const newMessage: Message = {
      id: messages.length + 1,
      role: 'user',
      content: inputValue
    }
    
    setMessages([...messages, newMessage])
    setInputValue('')
    
    // TODO: Send materials along with the message to backend/Gemini
    // const materialIds = materials.map(m => m.id)
    
    // Simulate AI response (in production, this would call your backend)
    setTimeout(() => {
      const aiResponse: Message = {
        id: messages.length + 2,
        role: 'assistant',
        content: "I understand your question. Let me help you with that..."
      }
      setMessages(prev => [...prev, aiResponse])
    }, 1000)
  }

  const handleAddMaterial = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files)
      const newMaterials = files.map((file, index) => ({
        id: Date.now() + index,
        name: file.name.replace('.pdf', ''),
        file: file,
        pages: Math.floor(Math.random() * 20) + 5 // Placeholder, you'd get this from PDF parsing
      }))
      setMaterials(prev => [...prev, ...newMaterials])
    }
  }

  const handleRemoveMaterial = (id: number) => {
    setMaterials(prev => prev.filter(material => material.id !== id))
  }

  return (
    <AppLayout>
    <div className="h-[calc(100vh-8rem)] flex gap-6 mt-5">
      {/* Sidebar */}
      <div className="w-96 space-y-6">
   

        {/* Your Materials Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Your Materials</CardTitle>
              </div>
              <label htmlFor="material-upload">
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => document.getElementById('material-upload')?.click()}
                  type="button"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </label>
              <input
                id="material-upload"
                type="file"
                accept=".pdf"
                multiple
                onChange={handleAddMaterial}
                className="hidden"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {materials.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-sm text-muted-foreground mb-2">No materials added yet</p>
                <p className="text-xs text-muted-foreground">Click + to add PDF materials</p>
              </div>
            ) : (
              materials.map((material) => (
                <div 
                  key={material.id}
                  className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-sm truncate block">{material.name}</span>
                        <span className="text-xs text-muted-foreground">.pdf</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveMaterial(material.id)}
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Chat Area */}
      <Card className="flex-1 flex flex-col bg-muted/30">
        <CardHeader className="border-b bg-background/50">
          <CardTitle>AI Tutor</CardTitle>
          <CardDescription>Get personalized help with your study materials</CardDescription>
        </CardHeader>
        
        {/* Messages */}
        <ScrollArea className="flex-1 p-6">
          <div className="space-y-4">
            {messages.map((message) => (
              <div 
                key={message.id}
                className="flex gap-3 items-start"
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
                    className={`rounded-lg px-4 py-3 ${
                      message.role === 'user' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted border'
                    }`}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
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
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="p-6 border-t bg-background/50">
          <div className="flex gap-3">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask me anything about your study materials..."
              className="flex-1 h-12 px-4 text-base bg-background"
            />
            <Button 
              onClick={handleSend}
              size="lg"
              className="h-12 px-6 gap-2"
              disabled={!inputValue.trim()}
            >
              <Send className="h-4 w-4" />
              Send
            </Button>
          </div>
        </div>
      </Card>
    </div>
    </AppLayout>
  )
}
 
