import { createFileRoute, Link } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Upload, 
  FileText, 
  Brain, 
  TrendingUp, 
  Clock, 
  Target,
  Sparkles,
  BookOpen,
  ArrowRight
} from 'lucide-react'
import AppLayout from '@/components/app-layout'

export const Route = createFileRoute('/__protected/dashboard')({
  component: RouteComponent,
})

function RouteComponent() {
  const recentActivity = [
    { type: 'note', title: 'Algorithms Notes', time: '2 hours ago', status: 'completed' },
    { type: 'quiz', title: 'Data Structures Quiz', time: '5 hours ago', status: 'completed' },
    { type: 'upload', title: 'OS Concepts.pdf', time: '1 day ago', status: 'processing' },
  ]

  const quickActions = [
    { icon: Upload, label: 'Upload Lecture', to: '/upload', color: 'bg-primary' },
    { icon: Brain, label: 'Start Quiz', to: '/quizzes', color: 'bg-blue-500' },
    { icon: Sparkles, label: 'AI Tutor', to: '/tutor', color: 'bg-purple-500' },
    { icon: FileText, label: 'View Notes', to: '/notes', color: 'bg-green-500' },
  ]

  return (
    <AppLayout>
    <div className="space-y-6 mt-5">
      {/* Welcome Section */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Welcome back! 👋</h2>
        <p className="text-muted-foreground mt-1">Here's what's happening with your studies today</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {quickActions.map((action, index) => {
          const Icon = action.icon
          return (
            <Link key={index} to={action.to}>
              <Card className="hover:shadow-lg transition-all cursor-pointer border-2 hover:border-primary/50">
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center text-center gap-3">
                    <div className={`h-14 w-14 rounded-full ${action.color} flex items-center justify-center`}>
                      <Icon className="h-7 w-7 text-white" />
                    </div>
                    <span className="font-semibold">{action.label}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Notes</p>
                <p className="text-2xl font-bold mt-1">12</p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  +3 this week
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Quizzes Taken</p>
                <p className="text-2xl font-bold mt-1">8</p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  +2 this week
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Brain className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Study Time</p>
                <p className="text-2xl font-bold mt-1">24h</p>
                <p className="text-xs text-muted-foreground mt-1">This month</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-500/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg. Score</p>
                <p className="text-2xl font-bold mt-1">85%</p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  +5% improvement
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <Target className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Your latest study sessions and uploads</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="gap-1">
                View All
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                      activity.type === 'note' ? 'bg-primary/10' :
                      activity.type === 'quiz' ? 'bg-blue-500/10' :
                      'bg-purple-500/10'
                    }`}>
                      {activity.type === 'note' && <FileText className="h-5 w-5 text-primary" />}
                      {activity.type === 'quiz' && <Brain className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
                      {activity.type === 'upload' && <Upload className="h-5 w-5 text-purple-600 dark:text-purple-400" />}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{activity.title}</p>
                      <p className="text-xs text-muted-foreground">{activity.time}</p>
                    </div>
                  </div>
                  <Badge variant={activity.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
                    {activity.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Study Tips */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Study Tips</CardTitle>
            </div>
            <CardDescription>AI-powered study recommendations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-start gap-2">
                  <BookOpen className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  <div>
                    <p className="text-sm font-medium mb-1">Review your notes</p>
                    <p className="text-xs text-muted-foreground">You haven't reviewed "Algorithms" in 3 days</p>
                  </div>
                </div>
              </div>
              
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-start gap-2">
                  <Brain className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm font-medium mb-1">Practice more</p>
                    <p className="text-xs text-muted-foreground">Take a quiz on Data Structures to reinforce learning</p>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-start gap-2">
                  <Target className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm font-medium mb-1">Stay consistent</p>
                    <p className="text-xs text-muted-foreground">Study for 30 minutes daily to reach your goal</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Study Progress Chart Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Study Progress</CardTitle>
          <CardDescription>Your learning journey over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
            Chart placeholder - Study time & quiz scores over the last 30 days
          </div>
        </CardContent>
      </Card>
    </div>
    </AppLayout>
  )
}
