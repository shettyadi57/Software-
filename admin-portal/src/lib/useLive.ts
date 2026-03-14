'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000'

export interface LiveEvent {
  type: string
  session_id?: string
  student_id?: string
  violation_type?: string
  severity?: string
  risk_delta?: number
  attention_score?: number
  risk_score?: number
  timestamp?: number
  [key: string]: any
}

export interface LiveState {
  [sessionId: string]: {
    student_id: string
    exam_id: string
    attention_score: number
    risk_score: number
    last_seen: number
  }
}

export function useLiveEvents(onEvent?: (evt: LiveEvent) => void) {
  const wsRef = useRef<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const [events, setEvents] = useState<LiveEvent[]>([])
  const [liveState, setLiveState] = useState<LiveState>({})
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null)
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(`${WS_URL}/ws/admin`)
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        // Keep-alive ping
        const ping = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }))
          } else {
            clearInterval(ping)
          }
        }, 20000)
      }

      ws.onmessage = (evt) => {
        try {
          const msg: LiveEvent = JSON.parse(evt.data)
          if (msg.type === 'pong') return

          if (msg.type === 'init') {
            // Restore initial state snapshot
            const state: LiveState = {}
            ;(msg.active_sessions || []).forEach((s: any) => {
              state[s.session_id] = s
            })
            setLiveState(state)
            return
          }

          // Update live state
          if (msg.session_id) {
            if (msg.type === 'student_disconnected') {
              setLiveState(prev => {
                const next = { ...prev }
                delete next[msg.session_id!]
                return next
              })
            } else {
              setLiveState(prev => ({
                ...prev,
                [msg.session_id!]: {
                  student_id: msg.student_id || prev[msg.session_id!]?.student_id || '?',
                  exam_id: msg.exam_id || prev[msg.session_id!]?.exam_id || '?',
                  attention_score: msg.attention_score ?? prev[msg.session_id!]?.attention_score ?? 100,
                  risk_score: msg.risk_score ?? (prev[msg.session_id!]?.risk_score ?? 0) + (msg.risk_delta ?? 0),
                  last_seen: msg.timestamp || Date.now() / 1000,
                },
              }))
            }
          }

          setEvents(prev => [msg, ...prev].slice(0, 200))
          onEventRef.current?.(msg)
        } catch (e) {
          console.error('[AEGIS WS] parse error', e)
        }
      }

      ws.onclose = () => {
        setConnected(false)
        reconnectTimer.current = setTimeout(connect, 3000)
      }

      ws.onerror = () => ws.close()
    } catch (e) {
      reconnectTimer.current = setTimeout(connect, 5000)
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      wsRef.current?.close()
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
    }
  }, [connect])

  return { connected, events, liveState }
}
