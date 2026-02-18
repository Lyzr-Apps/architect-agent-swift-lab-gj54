'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { callAIAgent, type AIAgentResponse } from '@/lib/aiAgent'
import { getSchedule, getScheduleLogs, pauseSchedule, resumeSchedule, cronToHuman, triggerScheduleNow, type Schedule, type ExecutionLog } from '@/lib/scheduler'
import { useLyzrAgentEvents } from '@/lib/lyzrAgentEvents'
import { AgentActivityPanel } from '@/components/AgentActivityPanel'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { FiSun, FiZap, FiClock, FiMail, FiSend, FiTrash2, FiEdit3, FiCheck, FiX, FiChevronDown, FiChevronUp, FiCopy, FiRefreshCw, FiPlay, FiPause, FiCalendar, FiSearch, FiFilter, FiActivity, FiAlertCircle, FiCheckCircle, FiTool, FiTag, FiLayers, FiSettings } from 'react-icons/fi'
import { HiOutlineLightBulb, HiOutlineSparkles } from 'react-icons/hi'

// ─── Constants ───────────────────────────────────────────────────────────────

const MANAGER_AGENT_ID = '69959f9fa88c1b2285b16c7d'
const EMAIL_AGENT_ID = '69959fbbe6a5282cfa0be109'
const SCHEDULE_ID = '69959fc3399dfadeac379e2c'

const STORAGE_KEY_CAMPAIGNS = 'daily-idea-engine-campaigns'
const STORAGE_KEY_MONTHLY = 'daily-idea-engine-monthly-count'
const STORAGE_KEY_MONTH = 'daily-idea-engine-current-month'

// ─── TypeScript Interfaces ───────────────────────────────────────────────────

interface Idea {
  id: string
  title: string
  prompt_suggestion: string
  tools: string[]
  hours_saved_per_week: number
  category: string
  benefit_statement: string
}

interface CampaignEntry {
  id: string
  date: string
  ideas: Idea[]
  recipientCount: number
  recipientEmails: string
  subjectLine: string
  status: 'generated' | 'sent'
  sentAt?: string
}

// ─── Sample Data ─────────────────────────────────────────────────────────────

const SAMPLE_IDEAS: Idea[] = [
  {
    id: 'sample-1',
    title: 'Customer Onboarding Automator',
    prompt_suggestion: 'Build an agent that sends personalized welcome emails, schedules onboarding calls, and creates CRM entries for new customers automatically.',
    tools: ['Gmail', 'Google Calendar', 'HubSpot CRM'],
    hours_saved_per_week: 8,
    category: 'Customer Success',
    benefit_statement: 'Reduces manual onboarding steps by 90%, ensuring every new customer receives a consistent, timely welcome experience.',
  },
  {
    id: 'sample-2',
    title: 'Social Media Trend Spotter',
    prompt_suggestion: 'Create an agent that monitors trending topics on X (Twitter) and LinkedIn, then drafts relevant post ideas tailored to your brand voice.',
    tools: ['Twitter API', 'LinkedIn', 'Slack'],
    hours_saved_per_week: 5,
    category: 'Marketing',
    benefit_statement: 'Stay ahead of industry conversations without manually scrolling feeds -- get curated trend alerts delivered to Slack.',
  },
  {
    id: 'sample-3',
    title: 'Meeting Notes Summarizer',
    prompt_suggestion: 'Design an agent that joins Zoom meetings, transcribes key discussion points, assigns action items, and posts summaries to Notion.',
    tools: ['Zoom', 'Notion', 'Slack'],
    hours_saved_per_week: 6,
    category: 'Productivity',
    benefit_statement: 'Never lose track of meeting decisions again. Auto-generated summaries with tagged action items keep the entire team aligned.',
  },
  {
    id: 'sample-4',
    title: 'Invoice Processing Pipeline',
    prompt_suggestion: 'Build an agent that extracts data from uploaded invoices, validates amounts, creates entries in QuickBooks, and flags anomalies for review.',
    tools: ['QuickBooks', 'Google Drive', 'Gmail'],
    hours_saved_per_week: 10,
    category: 'Finance',
    benefit_statement: 'Eliminates manual data entry for invoices, reducing processing time from 15 minutes to under 30 seconds per invoice.',
  },
  {
    id: 'sample-5',
    title: 'Competitive Intelligence Tracker',
    prompt_suggestion: 'Create an agent that monitors competitor websites, press releases, and product updates, then compiles a weekly intelligence brief.',
    tools: ['Web Scraper', 'Google Sheets', 'Gmail'],
    hours_saved_per_week: 4,
    category: 'Strategy',
    benefit_statement: 'Automated competitive monitoring ensures you never miss a market shift while freeing your team from tedious manual research.',
  },
]

const SAMPLE_CAMPAIGNS: CampaignEntry[] = [
  {
    id: 'camp-1',
    date: '2026-02-17',
    ideas: SAMPLE_IDEAS.slice(0, 3),
    recipientCount: 45,
    recipientEmails: 'team@company.com, partners@startup.io',
    subjectLine: '3 AI Agent Ideas to Supercharge Your Week',
    status: 'sent',
    sentAt: '2026-02-17T09:15:00Z',
  },
  {
    id: 'camp-2',
    date: '2026-02-16',
    ideas: SAMPLE_IDEAS.slice(2, 5),
    recipientCount: 38,
    recipientEmails: 'newsletter@company.com',
    subjectLine: 'Fresh Agent Ideas: Productivity + Finance + Strategy',
    status: 'sent',
    sentAt: '2026-02-16T08:30:00Z',
  },
  {
    id: 'camp-3',
    date: '2026-02-15',
    ideas: SAMPLE_IDEAS.slice(0, 2),
    recipientCount: 0,
    recipientEmails: '',
    subjectLine: 'Automate Customer Success & Marketing Today',
    status: 'generated',
  },
]

// ─── Markdown Helpers ────────────────────────────────────────────────────────

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-2">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### '))
          return <h4 key={i} className="font-semibold text-sm mt-3 mb-1">{line.slice(4)}</h4>
        if (line.startsWith('## '))
          return <h3 key={i} className="font-semibold text-base mt-3 mb-1">{line.slice(3)}</h3>
        if (line.startsWith('# '))
          return <h2 key={i} className="font-bold text-lg mt-4 mb-2">{line.slice(2)}</h2>
        if (line.startsWith('- ') || line.startsWith('* '))
          return <li key={i} className="ml-4 list-disc text-sm">{formatInline(line.slice(2))}</li>
        if (/^\d+\.\s/.test(line))
          return <li key={i} className="ml-4 list-decimal text-sm">{formatInline(line.replace(/^\d+\.\s/, ''))}</li>
        if (!line.trim()) return <div key={i} className="h-1" />
        return <p key={i} className="text-sm">{formatInline(line)}</p>
      })}
    </div>
  )
}

function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i} className="font-semibold">{part}</strong> : part
  )
}

// ─── Utility Helpers ─────────────────────────────────────────────────────────

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return dateStr
  }
}

function formatDateTime(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return dateStr
  }
}

// ─── Response Parsers ────────────────────────────────────────────────────────

function parseManagerResponse(result: AIAgentResponse): { ideas: Idea[], campaignSubjectLine: string, generationDate: string, totalIdeas: number } | null {
  if (!result.success) return null

  const response = result.response
  if (!response) return null

  let data: any = response.result

  if (data && typeof data === 'object' && 'result' in data && !('ideas' in data)) {
    data = data.result
  }

  if (typeof data === 'string') {
    try {
      data = JSON.parse(data)
    } catch {
      return null
    }
  }

  if (!data || typeof data !== 'object') return null

  if ('result' in data && !('ideas' in data)) {
    data = data.result
  }

  if (typeof data === 'string') {
    try {
      data = JSON.parse(data)
    } catch {
      return null
    }
  }

  if (!data || typeof data !== 'object') return null

  const ideas = Array.isArray(data.ideas) ? data.ideas : []

  return {
    ideas: ideas.map((idea: any) => ({
      id: generateId(),
      title: String(idea?.title || ''),
      prompt_suggestion: String(idea?.prompt_suggestion || ''),
      tools: Array.isArray(idea?.tools) ? idea.tools.map(String) : [],
      hours_saved_per_week: Number(idea?.hours_saved_per_week) || 0,
      category: String(idea?.category || 'General'),
      benefit_statement: String(idea?.benefit_statement || ''),
    })),
    campaignSubjectLine: String(data.campaign_subject_line || ''),
    generationDate: String(data.generation_date || new Date().toISOString()),
    totalIdeas: Number(data.total_ideas) || ideas.length,
  }
}

function parseEmailResponse(result: AIAgentResponse): { emailSent: boolean, recipientCount: number, subjectLine: string, deliveryStatus: string, sentAt: string } | null {
  if (!result.success) return null

  const response = result.response
  if (!response) return null

  let data: any = response.result

  if (data && typeof data === 'object' && 'result' in data && !('email_sent' in data)) {
    data = data.result
  }

  if (typeof data === 'string') {
    try {
      data = JSON.parse(data)
    } catch {
      return null
    }
  }

  if (!data || typeof data !== 'object') return null

  if ('result' in data && !('email_sent' in data)) {
    data = data.result
  }

  return {
    emailSent: Boolean(data?.email_sent),
    recipientCount: Number(data?.recipient_count) || 0,
    subjectLine: String(data?.subject_line || ''),
    deliveryStatus: String(data?.delivery_status || ''),
    sentAt: String(data?.sent_at || new Date().toISOString()),
  }
}

// ─── localStorage helpers ────────────────────────────────────────────────────

function loadCampaigns(): CampaignEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(STORAGE_KEY_CAMPAIGNS)
    if (!stored) return []
    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveCampaigns(campaigns: CampaignEntry[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY_CAMPAIGNS, JSON.stringify(campaigns))
  } catch {
    // silently fail
  }
}

function loadMonthlyCount(): { count: number, month: string } {
  if (typeof window === 'undefined') return { count: 0, month: '' }
  try {
    const month = localStorage.getItem(STORAGE_KEY_MONTH) || ''
    const count = parseInt(localStorage.getItem(STORAGE_KEY_MONTHLY) || '0', 10)
    return { count, month }
  } catch {
    return { count: 0, month: '' }
  }
}

function saveMonthlyCount(count: number, month: string) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY_MONTHLY, String(count))
    localStorage.setItem(STORAGE_KEY_MONTH, month)
  } catch {
    // silently fail
  }
}

// ─── IdeaCard Component ──────────────────────────────────────────────────────

function IdeaCard({
  idea,
  onUpdate,
  onDelete,
}: {
  idea: Idea
  onUpdate: (id: string, field: keyof Idea, value: string | string[] | number) => void
  onDelete: (id: string) => void
}) {
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const startEdit = (field: string, currentValue: string) => {
    setEditingField(field)
    setEditValue(currentValue)
  }

  const confirmEdit = (field: keyof Idea) => {
    onUpdate(idea.id, field, editValue)
    setEditingField(null)
  }

  const cancelEdit = () => {
    setEditingField(null)
    setEditValue('')
  }

  return (
    <Card className="backdrop-blur-[16px] bg-white/75 border border-white/[0.18] shadow-md rounded-[14px] transition-all duration-300 hover:shadow-lg group">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {editingField === 'title' ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="text-base font-semibold"
                  autoFocus
                />
                <Button size="sm" variant="ghost" onClick={() => confirmEdit('title')}><FiCheck className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={cancelEdit}><FiX className="h-4 w-4" /></Button>
              </div>
            ) : (
              <CardTitle
                className="text-base font-semibold cursor-pointer hover:text-primary transition-colors flex items-center gap-2"
                onClick={() => startEdit('title', idea.title)}
              >
                <HiOutlineLightBulb className="h-5 w-5 text-primary flex-shrink-0" />
                <span>{idea.title}</span>
                <FiEdit3 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              </CardTitle>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant="secondary" className="bg-primary/10 text-primary border-0 whitespace-nowrap">
              <FiClock className="h-3 w-3 mr-1" />
              {idea.hours_saved_per_week}h/wk saved
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
              onClick={() => onDelete(idea.id)}
            >
              <FiTrash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="outline" className="text-xs">
            <FiTag className="h-3 w-3 mr-1" />
            {idea.category}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-xs text-muted-foreground font-medium mb-1.5 block">Prompt Suggestion</Label>
          {editingField === 'prompt_suggestion' ? (
            <div className="space-y-2">
              <Textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                rows={3}
                autoFocus
              />
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => confirmEdit('prompt_suggestion')}><FiCheck className="h-4 w-4 mr-1" /> Save</Button>
                <Button size="sm" variant="ghost" onClick={cancelEdit}><FiX className="h-4 w-4 mr-1" /> Cancel</Button>
              </div>
            </div>
          ) : (
            <p
              className="text-sm text-foreground/80 cursor-pointer hover:bg-muted/50 rounded-md p-2 -m-2 transition-colors"
              onClick={() => startEdit('prompt_suggestion', idea.prompt_suggestion)}
            >
              {idea.prompt_suggestion || 'Click to add prompt suggestion...'}
            </p>
          )}
        </div>
        <div>
          <Label className="text-xs text-muted-foreground font-medium mb-1.5 block">Tools & Integrations</Label>
          <div className="flex flex-wrap gap-1.5">
            {Array.isArray(idea.tools) && idea.tools.map((tool, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                <FiTool className="h-3 w-3 mr-1" />
                {tool}
              </Badge>
            ))}
            {(!Array.isArray(idea.tools) || idea.tools.length === 0) && (
              <span className="text-xs text-muted-foreground">No tools specified</span>
            )}
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground font-medium mb-1.5 block">Benefit</Label>
          {editingField === 'benefit_statement' ? (
            <div className="space-y-2">
              <Textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                rows={2}
                autoFocus
              />
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => confirmEdit('benefit_statement')}><FiCheck className="h-4 w-4 mr-1" /> Save</Button>
                <Button size="sm" variant="ghost" onClick={cancelEdit}><FiX className="h-4 w-4 mr-1" /> Cancel</Button>
              </div>
            </div>
          ) : (
            <p
              className="text-sm text-foreground/70 italic cursor-pointer hover:bg-muted/50 rounded-md p-2 -m-2 transition-colors"
              onClick={() => startEdit('benefit_statement', idea.benefit_statement)}
            >
              {idea.benefit_statement || 'Click to add benefit statement...'}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── SkeletonIdeaCard Component ──────────────────────────────────────────────

function SkeletonIdeaCard() {
  return (
    <Card className="backdrop-blur-[16px] bg-white/75 border border-white/[0.18] shadow-md rounded-[14px]">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/4" />
          </div>
          <Skeleton className="h-6 w-24" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-12 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-14" />
          </div>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-8 w-full" />
        </div>
      </CardContent>
    </Card>
  )
}

// ─── CampaignRow Component ───────────────────────────────────────────────────

function CampaignRow({
  campaign,
  onResend,
  onCopy,
}: {
  campaign: CampaignEntry
  onResend: (campaign: CampaignEntry) => void
  onCopy: (campaign: CampaignEntry) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card className="backdrop-blur-[16px] bg-white/75 border border-white/[0.18] shadow-md rounded-[14px]">
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <div className="p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <FiCalendar className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{campaign.subjectLine || 'Untitled Campaign'}</p>
              <p className="text-xs text-muted-foreground">{formatDate(campaign.date)}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge variant="outline" className="text-xs">{Array.isArray(campaign.ideas) ? campaign.ideas.length : 0} ideas</Badge>
              {campaign.status === 'sent' ? (
                <Badge className="bg-green-100 text-green-700 border-0 text-xs">
                  <FiCheckCircle className="h-3 w-3 mr-1" />
                  Sent
                </Badge>
              ) : (
                <Badge className="bg-yellow-100 text-yellow-700 border-0 text-xs">
                  <FiClock className="h-3 w-3 mr-1" />
                  Draft
                </Badge>
              )}
              {(campaign.recipientCount ?? 0) > 0 && (
                <span className="text-xs text-muted-foreground">{campaign.recipientCount} recipients</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button size="sm" variant="ghost" onClick={() => onCopy(campaign)} title="Copy content">
              <FiCopy className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onResend(campaign)} title="Resend campaign">
              <FiRefreshCw className="h-4 w-4" />
            </Button>
            <CollapsibleTrigger asChild>
              <Button size="sm" variant="ghost">
                {expanded ? <FiChevronUp className="h-4 w-4" /> : <FiChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>
        <CollapsibleContent>
          <Separator />
          <div className="p-4 space-y-3">
            {campaign.sentAt && (
              <p className="text-xs text-muted-foreground">Sent at: {formatDateTime(campaign.sentAt)}</p>
            )}
            {campaign.recipientEmails && (
              <p className="text-xs text-muted-foreground">To: {campaign.recipientEmails}</p>
            )}
            {Array.isArray(campaign.ideas) && campaign.ideas.map((idea, idx) => (
              <Card key={idea.id || idx} className="bg-muted/30 border-0">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-medium text-sm">{idea.title}</p>
                    <Badge variant="secondary" className="text-xs flex-shrink-0">{idea.category}</Badge>
                  </div>
                  <p className="text-xs text-foreground/70 mb-2">{idea.prompt_suggestion}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {Array.isArray(idea.tools) && idea.tools.map((tool, tidx) => (
                      <Badge key={tidx} variant="outline" className="text-xs">{tool}</Badge>
                    ))}
                    <span className="text-xs text-primary font-medium ml-auto">{idea.hours_saved_per_week}h/wk saved</span>
                  </div>
                  {idea.benefit_statement && (
                    <p className="text-xs text-foreground/60 italic mt-2">{idea.benefit_statement}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}

// ─── Main Page Component ─────────────────────────────────────────────────────

export default function Page() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('dashboard')
  const [showSample, setShowSample] = useState(false)
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [subjectLine, setSubjectLine] = useState('')
  const [generationStatus, setGenerationStatus] = useState<'pending' | 'generated' | 'sent'>('pending')

  // Email form
  const [recipientEmails, setRecipientEmails] = useState('')
  const [ccEmails, setCcEmails] = useState('')

  // Loading states
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)

  // Banners
  const [successBanner, setSuccessBanner] = useState<string | null>(null)
  const [errorBanner, setErrorBanner] = useState<string | null>(null)

  // Campaign history
  const [campaigns, setCampaigns] = useState<CampaignEntry[]>([])
  const [monthlySentCount, setMonthlySentCount] = useState(0)
  const [currentMonth, setCurrentMonth] = useState('')

  // Campaign filters
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')

  // Schedule state
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [scheduleLogs, setScheduleLogs] = useState<ExecutionLog[]>([])
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [scheduleActionLoading, setScheduleActionLoading] = useState(false)

  // Agent activity
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const agentActivity = useLyzrAgentEvents(sessionId)
  const [activityPanelOpen, setActivityPanelOpen] = useState(false)

  // Today string (stable after mount)
  const [todayStr, setTodayStr] = useState('')

  // ── Initialize ─────────────────────────────────────────────────────────────
  useEffect(() => {
    setTodayStr(new Date().toISOString().split('T')[0])

    const stored = loadCampaigns()
    setCampaigns(stored)

    const nowMonth = new Date().toISOString().slice(0, 7)
    const { count, month } = loadMonthlyCount()
    if (month === nowMonth) {
      setMonthlySentCount(count)
    } else {
      setMonthlySentCount(0)
      saveMonthlyCount(0, nowMonth)
    }
    setCurrentMonth(nowMonth)
  }, [])

  // ── Save campaigns to localStorage ────────────────────────────────────────
  useEffect(() => {
    if (campaigns.length > 0) {
      saveCampaigns(campaigns)
    }
  }, [campaigns])

  // ── Load schedule data ─────────────────────────────────────────────────────
  const loadScheduleData = useCallback(async () => {
    setScheduleLoading(true)
    try {
      const [schedResult, logsResult] = await Promise.all([
        getSchedule(SCHEDULE_ID),
        getScheduleLogs(SCHEDULE_ID, { limit: 10 }),
      ])
      if (schedResult.success && schedResult.schedule) {
        setSchedule(schedResult.schedule)
      }
      if (logsResult.success) {
        setScheduleLogs(Array.isArray(logsResult.executions) ? logsResult.executions : [])
      }
    } catch {
      // silently handle
    }
    setScheduleLoading(false)
  }, [])

  useEffect(() => {
    loadScheduleData()
  }, [loadScheduleData])

  // ── Banner auto-dismiss ───────────────────────────────────────────────────
  useEffect(() => {
    if (successBanner) {
      const timer = setTimeout(() => setSuccessBanner(null), 6000)
      return () => clearTimeout(timer)
    }
  }, [successBanner])

  useEffect(() => {
    if (errorBanner) {
      const timer = setTimeout(() => setErrorBanner(null), 8000)
      return () => clearTimeout(timer)
    }
  }, [errorBanner])

  // ── Unique categories from campaigns ──────────────────────────────────────
  const allCategories = useMemo(() => {
    const cats = new Set<string>()
    campaigns.forEach((c) => {
      if (Array.isArray(c.ideas)) {
        c.ideas.forEach((idea) => {
          if (idea.category) cats.add(idea.category)
        })
      }
    })
    return Array.from(cats).sort()
  }, [campaigns])

  // sample categories for the dropdown when sample is on
  const sampleCategories = useMemo(() => {
    const cats = new Set<string>()
    SAMPLE_CAMPAIGNS.forEach((c) => {
      if (Array.isArray(c.ideas)) {
        c.ideas.forEach((idea) => {
          if (idea.category) cats.add(idea.category)
        })
      }
    })
    return Array.from(cats).sort()
  }, [])

  const combinedCategories = useMemo(() => {
    const merged = new Set([...allCategories, ...(showSample ? sampleCategories : [])])
    return Array.from(merged).sort()
  }, [allCategories, sampleCategories, showSample])

  // ── Filtered campaigns ────────────────────────────────────────────────────
  const filteredCampaigns = useMemo(() => {
    let filtered = showSample ? [...SAMPLE_CAMPAIGNS, ...campaigns] : campaigns
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase()
      filtered = filtered.filter((c) => {
        const subjectMatch = (c.subjectLine || '').toLowerCase().includes(q)
        const ideaMatch = Array.isArray(c.ideas) && c.ideas.some(
          (idea) =>
            (idea.title || '').toLowerCase().includes(q) ||
            (idea.prompt_suggestion || '').toLowerCase().includes(q)
        )
        return subjectMatch || ideaMatch
      })
    }
    if (categoryFilter !== 'all') {
      filtered = filtered.filter((c) =>
        Array.isArray(c.ideas) && c.ideas.some((idea) => idea.category === categoryFilter)
      )
    }
    return filtered
  }, [campaigns, showSample, searchTerm, categoryFilter])

  // ── Generate Ideas ─────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    setGenerating(true)
    setErrorBanner(null)
    setSuccessBanner(null)
    setActiveAgentId(MANAGER_AGENT_ID)
    agentActivity.setProcessing(true)

    try {
      const result = await callAIAgent(
        'Generate 5 fresh, high-impact AI agent ideas for today. Include creative tools combinations, realistic hours-saved estimates, and compelling benefit statements. Focus on diverse categories across business functions.',
        MANAGER_AGENT_ID
      )

      if (result.session_id) {
        setSessionId(result.session_id)
      }

      const parsed = parseManagerResponse(result)
      if (parsed && parsed.ideas.length > 0) {
        setIdeas(parsed.ideas)
        setSubjectLine(parsed.campaignSubjectLine)
        setGenerationStatus('generated')
        setSuccessBanner(`Generated ${parsed.ideas.length} fresh ideas! Review and edit them below, then send as a campaign.`)

        const newCampaign: CampaignEntry = {
          id: generateId(),
          date: todayStr || new Date().toISOString().split('T')[0],
          ideas: parsed.ideas,
          recipientCount: 0,
          recipientEmails: '',
          subjectLine: parsed.campaignSubjectLine,
          status: 'generated',
        }
        setCampaigns((prev) => [newCampaign, ...prev])
      } else {
        setErrorBanner('Could not parse ideas from the agent response. The agent may have returned an unexpected format. Please try again.')
      }
    } catch {
      setErrorBanner('Failed to generate ideas. Please check your connection and try again.')
    }

    setGenerating(false)
    setActiveAgentId(null)
    agentActivity.setProcessing(false)
  }

  // ── Send Campaign ──────────────────────────────────────────────────────────
  const handleSendCampaign = async () => {
    if (!recipientEmails.trim()) {
      setErrorBanner('Please enter at least one recipient email address.')
      return
    }
    if (ideas.length === 0) {
      setErrorBanner('No ideas to send. Generate ideas first.')
      return
    }

    setSending(true)
    setErrorBanner(null)
    setSuccessBanner(null)
    setActiveAgentId(EMAIL_AGENT_ID)
    agentActivity.setProcessing(true)

    const emailMessage = `Send the following agent ideas as a nurture email campaign.

Recipients: ${recipientEmails.trim()}
Subject: ${subjectLine || 'Daily AI Agent Ideas from Architect'}
${ccEmails.trim() ? `CC: ${ccEmails.trim()}` : ''}

Content to send:
${ideas.map((idea, i) => `
Idea ${i + 1}: ${idea.title}
Category: ${idea.category}
Prompt: ${idea.prompt_suggestion}
Tools: ${Array.isArray(idea.tools) ? idea.tools.join(', ') : ''}
Hours Saved: ${idea.hours_saved_per_week}h/week
Benefit: ${idea.benefit_statement}
`).join('\n---\n')}

Format this as a professional HTML email with clear sections for each idea. Include a call-to-action to try building these agents on Architect.`

    try {
      const result = await callAIAgent(emailMessage, EMAIL_AGENT_ID)

      if (result.session_id) {
        setSessionId(result.session_id)
      }

      const parsed = parseEmailResponse(result)

      setGenerationStatus('sent')

      // Update monthly count
      const newCount = monthlySentCount + ideas.length
      setMonthlySentCount(newCount)
      if (currentMonth) {
        saveMonthlyCount(newCount, currentMonth)
      }

      // Update campaign history
      const recipientCount = recipientEmails.split(',').filter((e) => e.trim()).length
      const currentDate = todayStr || new Date().toISOString().split('T')[0]
      setCampaigns((prev) => {
        const todayCampaignIdx = prev.findIndex((c) => c.date === currentDate && c.status === 'generated')
        if (todayCampaignIdx >= 0) {
          const updated = [...prev]
          updated[todayCampaignIdx] = {
            ...updated[todayCampaignIdx],
            status: 'sent',
            recipientCount: parsed?.recipientCount || recipientCount,
            recipientEmails: recipientEmails.trim(),
            subjectLine: parsed?.subjectLine || subjectLine,
            sentAt: parsed?.sentAt || new Date().toISOString(),
          }
          return updated
        }
        return [
          {
            id: generateId(),
            date: currentDate,
            ideas: ideas,
            recipientCount: parsed?.recipientCount || recipientCount,
            recipientEmails: recipientEmails.trim(),
            subjectLine: parsed?.subjectLine || subjectLine,
            status: 'sent',
            sentAt: parsed?.sentAt || new Date().toISOString(),
          },
          ...prev,
        ]
      })

      if (parsed) {
        setSuccessBanner(`Campaign sent successfully! ${parsed.deliveryStatus ? `Status: ${parsed.deliveryStatus}` : ''} ${parsed.recipientCount ? `(${parsed.recipientCount} recipients)` : `(${recipientCount} recipients)`}`)
      } else {
        setSuccessBanner(`Campaign submitted! The email agent has processed your request to ${recipientCount} recipient(s).`)
      }
    } catch {
      setErrorBanner('Failed to send campaign. Please try again.')
    }

    setSending(false)
    setActiveAgentId(null)
    agentActivity.setProcessing(false)
  }

  // ── Idea mutations ─────────────────────────────────────────────────────────
  const updateIdea = (id: string, field: keyof Idea, value: string | string[] | number) => {
    setIdeas((prev) => prev.map((idea) => (idea.id === id ? { ...idea, [field]: value } : idea)))
  }

  const deleteIdea = (id: string) => {
    setIdeas((prev) => prev.filter((idea) => idea.id !== id))
  }

  // ── Campaign actions ───────────────────────────────────────────────────────
  const handleResendCampaign = (campaign: CampaignEntry) => {
    if (Array.isArray(campaign.ideas)) {
      setIdeas(campaign.ideas.map((idea) => ({ ...idea, id: generateId() })))
    }
    setSubjectLine(campaign.subjectLine || '')
    setRecipientEmails(campaign.recipientEmails || '')
    setGenerationStatus('generated')
    setActiveTab('dashboard')
    setSuccessBanner('Campaign loaded for resending. Update recipients and send again.')
  }

  const handleCopyCampaign = (campaign: CampaignEntry) => {
    const text = Array.isArray(campaign.ideas)
      ? campaign.ideas.map((idea, i) =>
          `Idea ${i + 1}: ${idea.title}\nCategory: ${idea.category}\nPrompt: ${idea.prompt_suggestion}\nTools: ${Array.isArray(idea.tools) ? idea.tools.join(', ') : ''}\nHours Saved: ${idea.hours_saved_per_week}h/week\nBenefit: ${idea.benefit_statement}`
        ).join('\n\n---\n\n')
      : ''
    try {
      navigator.clipboard.writeText(text)
      setSuccessBanner('Campaign content copied to clipboard!')
    } catch {
      setErrorBanner('Could not copy to clipboard.')
    }
  }

  // ── Schedule actions ───────────────────────────────────────────────────────
  const handleToggleSchedule = async () => {
    if (!schedule) return
    setScheduleActionLoading(true)
    try {
      if (schedule.is_active) {
        await pauseSchedule(SCHEDULE_ID)
      } else {
        await resumeSchedule(SCHEDULE_ID)
      }
      await loadScheduleData()
    } catch {
      setErrorBanner('Failed to update schedule.')
    }
    setScheduleActionLoading(false)
  }

  const handleTriggerNow = async () => {
    setScheduleActionLoading(true)
    try {
      const result = await triggerScheduleNow(SCHEDULE_ID)
      if (result.success) {
        setSuccessBanner('Schedule triggered! The agent will run shortly.')
      } else {
        setErrorBanner(result.error || 'Failed to trigger schedule.')
      }
    } catch {
      setErrorBanner('Failed to trigger schedule.')
    }
    setScheduleActionLoading(false)
  }

  // ── Display data based on sample toggle ────────────────────────────────────
  const displayIdeas = showSample && ideas.length === 0 ? SAMPLE_IDEAS : ideas
  const displaySubjectLine = showSample && !subjectLine ? 'Top 5 AI Agent Ideas to Transform Your Workflow This Week' : subjectLine
  const displayStatus = showSample && generationStatus === 'pending' ? 'generated' : generationStatus
  const displaySentCount = showSample ? monthlySentCount + 23 : monthlySentCount

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, hsl(30, 50%, 97%) 0%, hsl(20, 45%, 95%) 35%, hsl(40, 40%, 96%) 70%, hsl(15, 35%, 97%) 100%)' }}>
      {/* ── Top Navigation ── */}
      <header className="sticky top-0 z-40 backdrop-blur-[16px] bg-white/70 border-b border-white/[0.18]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-[10px] bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md shadow-primary/20">
              <FiSun className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-base text-foreground tracking-tight">Daily Idea Engine</h1>
              <p className="text-xs text-muted-foreground -mt-0.5">AI-powered agent idea generation</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="sample-toggle" className="text-xs text-muted-foreground cursor-pointer">Sample Data</Label>
              <Switch
                id="sample-toggle"
                checked={showSample}
                onCheckedChange={setShowSample}
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="relative"
              onClick={() => setActivityPanelOpen(!activityPanelOpen)}
            >
              <FiActivity className="h-4 w-4" />
              {agentActivity.isProcessing && (
                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 bg-primary rounded-full animate-pulse" />
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* ── Success/Error Banners ── */}
      <div className="max-w-6xl mx-auto px-6">
        {successBanner && (
          <div className="mt-4 p-4 rounded-[14px] bg-green-50 border border-green-200 flex items-start gap-3">
            <FiCheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-green-800">{successBanner}</p>
            </div>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-green-600" onClick={() => setSuccessBanner(null)}>
              <FiX className="h-4 w-4" />
            </Button>
          </div>
        )}
        {errorBanner && (
          <div className="mt-4 p-4 rounded-[14px] bg-red-50 border border-red-200 flex items-start gap-3">
            <FiAlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-800">{errorBanner}</p>
            </div>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-600" onClick={() => setErrorBanner(null)}>
              <FiX className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* ── Main Content ── */}
      <main className="max-w-6xl mx-auto px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 backdrop-blur-[16px] bg-white/60 border border-white/[0.18]">
            <TabsTrigger value="dashboard" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <HiOutlineLightBulb className="h-4 w-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <FiLayers className="h-4 w-4 mr-2" />
              Campaign History
            </TabsTrigger>
            <TabsTrigger value="schedule" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <FiSettings className="h-4 w-4 mr-2" />
              Schedule
            </TabsTrigger>
          </TabsList>

          {/* ════════════════════ DASHBOARD TAB ════════════════════ */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* Status Banner */}
            <Card className="backdrop-blur-[16px] bg-white/75 border border-white/[0.18] shadow-md rounded-[14px]">
              <CardContent className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <FiCalendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{todayStr ? formatDate(todayStr) : 'Loading...'}</span>
                    </div>
                    <Badge className={displayStatus === 'sent' ? 'bg-green-100 text-green-700 border-0' : displayStatus === 'generated' ? 'bg-blue-100 text-blue-700 border-0' : 'bg-muted text-muted-foreground border-0'}>
                      {displayStatus === 'sent' ? (
                        <><FiCheckCircle className="h-3 w-3 mr-1" /> Sent</>
                      ) : displayStatus === 'generated' ? (
                        <><FiZap className="h-3 w-3 mr-1" /> Generated</>
                      ) : (
                        <><FiClock className="h-3 w-3 mr-1" /> Pending</>
                      )}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FiMail className="h-4 w-4" />
                    <span className="font-medium text-foreground">{displaySentCount}</span>
                    <span>ideas sent this month</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Empty State / Generate CTA */}
            {displayIdeas.length === 0 && !generating && (
              <Card className="backdrop-blur-[16px] bg-white/75 border border-white/[0.18] shadow-md rounded-[14px]">
                <CardContent className="py-16 flex flex-col items-center justify-center text-center">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <HiOutlineSparkles className="h-8 w-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-semibold mb-2">Ready to Spark New Ideas?</h2>
                  <p className="text-sm text-muted-foreground max-w-md mb-6">
                    Generate fresh AI agent ideas curated for high impact. Each idea comes with tool suggestions, time-saving estimates, and actionable prompts you can edit before sending.
                  </p>
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300"
                    onClick={handleGenerate}
                    disabled={generating}
                  >
                    <FiZap className="h-5 w-5 mr-2" />
                    Generate Daily Ideas
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Loading Skeletons */}
            {generating && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <FiRefreshCw className="h-4 w-4 text-primary animate-spin" />
                  <span className="text-sm text-muted-foreground">Generating fresh ideas with the AI coordinator...</span>
                </div>
                <SkeletonIdeaCard />
                <SkeletonIdeaCard />
                <SkeletonIdeaCard />
              </div>
            )}

            {/* Idea Cards */}
            {!generating && displayIdeas.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <HiOutlineLightBulb className="h-5 w-5 text-primary" />
                    {showSample && ideas.length === 0 ? 'Sample' : "Today's"} Ideas ({displayIdeas.length})
                  </h2>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerate}
                    disabled={generating}
                    className="backdrop-blur-[16px] bg-white/60 border border-white/[0.18]"
                  >
                    <FiRefreshCw className="h-4 w-4 mr-2" />
                    Regenerate
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {displayIdeas.map((idea) => (
                    <IdeaCard
                      key={idea.id}
                      idea={idea}
                      onUpdate={showSample && ideas.length === 0 ? () => {} : updateIdea}
                      onDelete={showSample && ideas.length === 0 ? () => {} : deleteIdea}
                    />
                  ))}
                </div>

                {/* Total Hours Saved Summary */}
                <Card className="backdrop-blur-[16px] bg-gradient-to-r from-primary/5 to-accent/5 border border-white/[0.18] shadow-sm rounded-[14px]">
                  <CardContent className="p-4 flex items-center justify-center gap-3">
                    <FiZap className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium">
                      Total time saved: <strong className="text-primary">{displayIdeas.reduce((sum, idea) => sum + (idea.hours_saved_per_week || 0), 0)} hours/week</strong> across all ideas
                    </span>
                  </CardContent>
                </Card>

                {/* Recipient Input Section */}
                <Card className="backdrop-blur-[16px] bg-white/75 border border-white/[0.18] shadow-md rounded-[14px]">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <FiSend className="h-5 w-5 text-primary" />
                      Send as Email Campaign
                    </CardTitle>
                    <CardDescription>Enter recipient details and send these ideas as a professionally formatted email via Gmail.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="recipients" className="text-sm font-medium">Recipients *</Label>
                        <Input
                          id="recipients"
                          type="text"
                          placeholder="john@company.com, team@startup.io"
                          value={recipientEmails}
                          onChange={(e) => setRecipientEmails(e.target.value)}
                          className="mt-1.5"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Separate multiple emails with commas</p>
                      </div>
                      <div>
                        <Label htmlFor="cc" className="text-sm font-medium">CC (optional)</Label>
                        <Input
                          id="cc"
                          type="text"
                          placeholder="manager@company.com"
                          value={ccEmails}
                          onChange={(e) => setCcEmails(e.target.value)}
                          className="mt-1.5"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="subject" className="text-sm font-medium">Subject Line *</Label>
                      <Input
                        id="subject"
                        type="text"
                        placeholder="Enter email subject line..."
                        value={showSample && ideas.length === 0 && !subjectLine ? displaySubjectLine : subjectLine}
                        onChange={(e) => setSubjectLine(e.target.value)}
                        className="mt-1.5"
                      />
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button
                      className="bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300"
                      onClick={handleSendCampaign}
                      disabled={sending || !recipientEmails.trim()}
                    >
                      {sending ? (
                        <>
                          <FiRefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Sending Campaign...
                        </>
                      ) : (
                        <>
                          <FiSend className="h-4 w-4 mr-2" />
                          Send to Campaign
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* ════════════════════ CAMPAIGN HISTORY TAB ════════════════════ */}
          <TabsContent value="history" className="space-y-6">
            {/* Filter Bar */}
            <Card className="backdrop-blur-[16px] bg-white/75 border border-white/[0.18] shadow-md rounded-[14px]">
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                    <FiSearch className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <Input
                      placeholder="Search campaigns by keyword..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-0"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <FiFilter className="h-4 w-4 text-muted-foreground" />
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger className="w-[160px] h-9">
                        <SelectValue placeholder="All Categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {combinedCategories.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Campaign List */}
            {filteredCampaigns.length === 0 ? (
              <Card className="backdrop-blur-[16px] bg-white/75 border border-white/[0.18] shadow-md rounded-[14px]">
                <CardContent className="py-12 flex flex-col items-center justify-center text-center">
                  <FiLayers className="h-10 w-10 text-muted-foreground mb-3" />
                  <h3 className="font-semibold text-base mb-1">No Campaigns Yet</h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    {searchTerm || categoryFilter !== 'all'
                      ? 'No campaigns match your filters. Try adjusting the search or category.'
                      : 'Generate and send your first idea campaign to see it here. Toggle "Sample Data" to preview.'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredCampaigns.map((campaign) => (
                  <CampaignRow
                    key={campaign.id}
                    campaign={campaign}
                    onResend={handleResendCampaign}
                    onCopy={handleCopyCampaign}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ════════════════════ SCHEDULE TAB ════════════════════ */}
          <TabsContent value="schedule" className="space-y-6">
            {/* Schedule Status Card */}
            <Card className="backdrop-blur-[16px] bg-white/75 border border-white/[0.18] shadow-md rounded-[14px]">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FiCalendar className="h-5 w-5 text-primary" />
                  Daily Schedule
                </CardTitle>
                <CardDescription>
                  The Idea Generation Coordinator runs on a daily schedule to produce fresh ideas automatically.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {scheduleLoading && !schedule ? (
                  <div className="space-y-3">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-5 w-64" />
                    <Skeleton className="h-5 w-40" />
                  </div>
                ) : schedule ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium">Status</p>
                        <Badge className={schedule.is_active ? 'bg-green-100 text-green-700 border-0' : 'bg-muted text-muted-foreground border-0'}>
                          {schedule.is_active ? (
                            <><FiPlay className="h-3 w-3 mr-1" /> Active</>
                          ) : (
                            <><FiPause className="h-3 w-3 mr-1" /> Paused</>
                          )}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium">Frequency</p>
                        <p className="text-sm font-medium">{schedule.cron_expression ? cronToHuman(schedule.cron_expression) : 'Not set'}</p>
                        <p className="text-xs text-muted-foreground">{schedule.timezone || 'UTC'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium">Next Run</p>
                        <p className="text-sm font-medium">{schedule.next_run_time ? formatDateTime(schedule.next_run_time) : 'N/A'}</p>
                      </div>
                    </div>
                    {schedule.last_run_at && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FiClock className="h-3 w-3" />
                        Last run: {formatDateTime(schedule.last_run_at)}
                        {schedule.last_run_success !== null && (
                          <Badge variant="outline" className="text-xs">
                            {schedule.last_run_success ? 'Success' : 'Failed'}
                          </Badge>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Could not load schedule information. The schedule may not be configured yet.</p>
                )}
              </CardContent>
              <CardFooter className="flex gap-3 flex-wrap">
                {schedule && (
                  <>
                    <Button
                      variant={schedule.is_active ? 'outline' : 'default'}
                      size="sm"
                      onClick={handleToggleSchedule}
                      disabled={scheduleActionLoading}
                    >
                      {scheduleActionLoading ? (
                        <FiRefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : schedule.is_active ? (
                        <FiPause className="h-4 w-4 mr-2" />
                      ) : (
                        <FiPlay className="h-4 w-4 mr-2" />
                      )}
                      {schedule.is_active ? 'Pause Schedule' : 'Resume Schedule'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleTriggerNow}
                      disabled={scheduleActionLoading}
                    >
                      <FiZap className="h-4 w-4 mr-2" />
                      Run Now
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={loadScheduleData}
                      disabled={scheduleLoading}
                    >
                      <FiRefreshCw className={`h-4 w-4 mr-2 ${scheduleLoading ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                  </>
                )}
              </CardFooter>
            </Card>

            {/* Run History */}
            <Card className="backdrop-blur-[16px] bg-white/75 border border-white/[0.18] shadow-md rounded-[14px]">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FiActivity className="h-5 w-5 text-primary" />
                  Run History
                </CardTitle>
                <CardDescription>Recent executions of the daily idea generation schedule.</CardDescription>
              </CardHeader>
              <CardContent>
                {scheduleLogs.length === 0 ? (
                  <div className="text-center py-8">
                    <FiClock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No execution logs yet. The schedule will produce logs after its first run.</p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Time</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-xs">Attempt</TableHead>
                          <TableHead className="text-xs">Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {scheduleLogs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="text-xs">{formatDateTime(log.executed_at)}</TableCell>
                            <TableCell>
                              <Badge className={log.success ? 'bg-green-100 text-green-700 border-0 text-xs' : 'bg-red-100 text-red-700 border-0 text-xs'}>
                                {log.success ? 'Success' : 'Failed'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">{log.attempt}/{log.max_attempts}</TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                              {log.error_message || 'Completed successfully'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* ── Agent Activity Panel (Slide-out) ── */}
      {activityPanelOpen && (
        <div className="fixed right-0 top-0 h-full w-96 z-50 backdrop-blur-[16px] bg-white/90 border-l border-border shadow-2xl">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <FiActivity className="h-4 w-4 text-primary" />
              Agent Activity
            </h3>
            <Button size="sm" variant="ghost" onClick={() => setActivityPanelOpen(false)}>
              <FiX className="h-4 w-4" />
            </Button>
          </div>
          <ScrollArea className="h-[calc(100%-57px)]">
            <div className="p-4">
              <AgentActivityPanel
                isConnected={agentActivity.isConnected}
                events={agentActivity.events}
                thinkingEvents={agentActivity.thinkingEvents}
                lastThinkingMessage={agentActivity.lastThinkingMessage}
                activeAgentId={agentActivity.activeAgentId}
                activeAgentName={agentActivity.activeAgentName}
                isProcessing={agentActivity.isProcessing}
              />
            </div>
          </ScrollArea>
        </div>
      )}

      {/* ── Agent Info Footer ── */}
      <footer className="max-w-6xl mx-auto px-6 pb-8 pt-2">
        <Card className="backdrop-blur-[16px] bg-white/60 border border-white/[0.18] shadow-sm rounded-[14px]">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-6">
              <p className="text-xs font-medium text-muted-foreground">Powered by</p>
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${activeAgentId === MANAGER_AGENT_ID ? 'bg-primary animate-pulse' : 'bg-green-400'}`} />
                <span className="text-xs text-foreground font-medium">Idea Generation Coordinator</span>
                <span className="text-xs text-muted-foreground">(Manager Agent)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${activeAgentId === EMAIL_AGENT_ID ? 'bg-primary animate-pulse' : 'bg-green-400'}`} />
                <span className="text-xs text-foreground font-medium">Email Campaign Agent</span>
                <span className="text-xs text-muted-foreground">(Gmail)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </footer>
    </div>
  )
}
