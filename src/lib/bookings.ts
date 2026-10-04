import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { slotHasEnded } from './time'

export type Booking = {
  id: string
  apartment_id: string
  resident_id: string
  date: string
  slot: number
  created_at: string
  resident: { name: string } | null
  apartment: { label: string } | null
}

export type Block = {
  id: string
  start_date: string
  end_date: string
  slot: number | null
  reason: string
  created_at: string
}

const bookingSelect = '*, resident:residents(name), apartment:apartments(label)'

/** Bokningar och blockeringar från idag och framåt, uppdaterade i realtid. */
export function useSchedule(fromDate: string) {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [blocks, setBlocks] = useState<Block[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [b, bl] = await Promise.all([
      supabase.from('bookings').select(bookingSelect).gte('date', fromDate).order('date').order('slot'),
      supabase.from('blocks').select('*').gte('end_date', fromDate).order('start_date'),
    ])
    if (b.error || bl.error) {
      setError(b.error?.message ?? bl.error?.message ?? 'Kunde inte hämta schemat')
    } else {
      setBookings(b.data as Booking[])
      setBlocks(bl.data as Block[])
      setError(null)
    }
    setLoading(false)
  }, [fromDate])

  useEffect(() => {
    load()
    const channel = supabase
      .channel('schedule')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blocks' }, () => load())
      .subscribe()
    // Ladda om när appen kommer tillbaka i förgrunden (realtime kan ha tappat anslutningen).
    const onVisible = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  return { bookings, blocks, loading, error, reload: load }
}

export function findBlock(blocks: Block[], date: string, slot: number): Block | undefined {
  return blocks.find((b) => date >= b.start_date && date <= b.end_date && (b.slot === null || b.slot === slot))
}

/** Lägenhetens aktiva bokning: första som inte har slutat. */
export function activeBookingFor(bookings: Booking[], apartmentId: string | null | undefined): Booking | undefined {
  if (!apartmentId) return undefined
  return bookings.find((b) => b.apartment_id === apartmentId && !slotHasEnded(b.date, b.slot))
}

export const bookingApi = {
  async book(date: string, slot: number, apartmentId?: string) {
    const { data, error } = await supabase.rpc('book_slot', {
      p_date: date,
      p_slot: slot,
      p_apartment_id: apartmentId ?? null,
    })
    if (error) throw new Error(error.message)
    return data as Booking
  },
  async cancel(bookingId: string) {
    const { error } = await supabase.rpc('cancel_booking', { p_booking_id: bookingId })
    if (error) throw new Error(error.message)
  },
  async move(bookingId: string, date: string, slot: number) {
    const { data, error } = await supabase.rpc('move_booking', { p_booking_id: bookingId, p_date: date, p_slot: slot })
    if (error) throw new Error(error.message)
    return data as Booking
  },
  async createBlock(startDate: string, endDate: string, slot: number | null, reason: string) {
    const { data, error } = await supabase.rpc('create_block', {
      p_start_date: startDate,
      p_end_date: endDate,
      p_slot: slot,
      p_reason: reason,
    })
    if (error) throw new Error(error.message)
    return data as Block
  },
  async deleteBlock(id: string) {
    const { error } = await supabase.from('blocks').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },
}
