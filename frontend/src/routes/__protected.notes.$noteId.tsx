import { createFileRoute, Link } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Download, Star, BookOpen, Calendar } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import AppLayout from '@/components/app-layout'

export const Route = createFileRoute('/__protected/notes/$noteId')({
  component: RouteComponent,
})

const mockNotesData: Record<string, any> = {
  '0': {
    id: '0',
    title: 'Introduction to Algorithms',
    subject: 'Computer Science',
    date: 'Nov 10, 2025',
    pages: 5,
    excerpt: 'Key concepts: Big O notation, time complexity, space complexity...',
    sections: [
      {
        title: 'What is an Algorithm?',
        content: 'An algorithm is a step-by-step procedure for solving a problem or accomplishing a task. It must be finite, well-defined, and effective.',
        keyPoints: [
          'Must have clear inputs and outputs',
          'Each step must be unambiguous',
          'Must terminate after finite steps'
        ]
      },
      {
        title: 'Time Complexity',
        content: 'Time complexity measures how the runtime of an algorithm grows as the input size increases.',
        keyPoints: [
          'Big O notation: O(n), O(log n), O(n²)',
          'Best, average, and worst case analysis',
          'Space-time tradeoffs'
        ]
      },
      {
        title: 'Space Complexity',
        content: 'Space complexity refers to the amount of memory an algorithm uses relative to the input size.',
        keyPoints: [
          'Auxiliary space vs total space',
          'Stack space in recursive algorithms',
          'In-place algorithms minimize space complexity'
        ]
      }
    ]
  },
  '1': {
    id: '1',
    title: 'Data Structures Overview',
    subject: 'Computer Science',
    date: 'Nov 8, 2025',
    pages: 3,
    excerpt: 'Arrays, linked lists, stacks, queues, and their use cases...',
    sections: [
      {
        title: 'Arrays and Lists',
        content: 'Arrays are contiguous memory locations that store elements of the same type. Lists provide dynamic sizing.',
        keyPoints: [
          'Arrays: O(1) access, fixed size',
          'Lists: Dynamic sizing, O(n) insertion',
          'Use cases and tradeoffs'
        ]
      },
      {
        title: 'Stacks and Queues',
        content: 'Stacks follow LIFO (Last In First Out) principle, while queues follow FIFO (First In First Out).',
        keyPoints: [
          'Stack operations: push, pop, peek - all O(1)',
          'Queue operations: enqueue, dequeue - all O(1)',
          'Applications: function calls, BFS, task scheduling'
        ]
      }
    ]
  },
  '2': {
    id: '2',
    title: 'Operating Systems Basics',
    subject: 'Computer Science',
    date: 'Nov 5, 2025',
    pages: 7,
    excerpt: 'Process management, threading, synchronization, deadlocks...',
    sections: [
      {
        title: 'Process Management',
        content: 'The OS manages processes, allocating CPU time and resources efficiently.',
        keyPoints: [
          'Process states: new, ready, running, waiting, terminated',
          'Context switching',
          'Scheduling algorithms'
        ]
      },
      {
        title: 'Threading and Concurrency',
        content: 'Threads are lightweight processes that share the same memory space, enabling concurrent execution.',
        keyPoints: [
          'User threads vs kernel threads',
          'Benefits: parallelism, responsiveness, resource sharing',
          'Challenges: synchronization, race conditions'
        ]
      },
      {
        title: 'Deadlocks',
        content: 'A deadlock occurs when processes are waiting for resources held by each other, creating a circular wait.',
        keyPoints: [
          'Four conditions: mutual exclusion, hold and wait, no preemption, circular wait',
          'Prevention, avoidance, and detection strategies',
          'Banker\'s algorithm for deadlock avoidance'
        ]
      }
    ]
  }
}

function RouteComponent() {
  const { noteId } = Route.useParams()
  const note = mockNotesData[noteId]

  if (!note) {
    return (
      <AppLayout>
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <h2 className="text-2xl font-bold mb-2">Note not found</h2>
        <p className="text-muted-foreground mb-4">The note you are looking for does not exist.</p>
        <Link to="/notes">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Notes
          </Button>
        </Link>
      </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* Header with Title and Actions */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-2">{note.title}</h1>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Badge variant="secondary" className="text-xs">
                  {note.subject}
                </Badge>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  {note.date}
                </div>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="shrink-0">
              <Star className="h-5 w-5" />
            </Button>
          </div>

          {/* Excerpt */}
          <p className="text-sm text-muted-foreground">
            {note.excerpt}
          </p>

          {/* Actions */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <Badge variant="outline" className="text-xs">
              {note.pages} pages
            </Badge>
            <div className="flex items-center gap-2">
              <Link to="/notes">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
              </Link>
              <Button variant="ghost" size="sm" className="gap-2">
                <Download className="h-4 w-4" />
                Download
              </Button>
            </div>
          </div>
        </div>

        {/* Content Card */}
        <Card className="bg-white shadow-sm">
          <CardContent className="p-8">
            <div className="space-y-8">
              {note.sections.map((section: any, index: number) => (
                <div key={index}>
                  {index > 0 && <Separator className="my-8" />}
                  
                  {/* Section */}
                  <div className="space-y-4">
                    {/* Section Title */}
                    <div className="flex items-start gap-3">
                      <BookOpen className="h-6 w-6 text-primary mt-0.5 shrink-0" />
                      <h2 className="text-2xl font-bold">{section.title}</h2>
                    </div>

                    {/* Section Content */}
                    <p className="text-base leading-relaxed text-muted-foreground">
                      {section.content}
                    </p>

                    {/* Key Points */}
                    {section.keyPoints && section.keyPoints.length > 0 && (
                      <div className="mt-6 bg-muted/30 rounded-lg p-6">
                        <h3 className="text-sm font-bold mb-4 text-foreground">
                          Key Points:
                        </h3>
                        <ul className="space-y-3">
                          {section.keyPoints.map((point: string, pointIndex: number) => (
                            <li 
                              key={pointIndex} 
                              className="flex items-start gap-3 text-sm text-foreground"
                            >
                              <span className="text-primary mt-0.5 shrink-0 font-bold">▸</span>
                              <span>{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Generate Quiz Button */}
        <div className="mt-6">
          <Button 
            className="w-full h-14 text-base font-semibold bg-linear-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600"
            size="lg"
          >
            Generate Quiz from This Note
          </Button>
        </div>
      </div>
    </div>
    </AppLayout>
  )
}
