// BookingHistoryTab.jsx — Chronological booking log with WhatsApp action and Booking Details view

import { useState } from 'react';
import { MessageCircle, Phone, CheckCircle, Loader2, Trash2, Eye } from 'lucide-react';
import { Button } from '../shared/Button';
import { sendWhatsAppConfirmation } from '../../api/whatsapp';
import { simulateWebhookEvent } from '../../api/webhook';
import { format, parseISO } from 'date-fns';
import { BOOKING_SOURCES } from '../../data/seedData';

function SourceTag({ source }) {
  const isGathern = source === BOOKING_SOURCES.GATHERN;
  return (
    <span
      className={`inline-flex items-center text-xs px-2 py-0.5 rounded-md font-medium ${
        isGathern
          ? 'bg-violet-500/15 text-violet-400 border border-violet-500/20'
          : 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
      }`}
    >
      {source}
    </span>
  );
}

function WhatsAppButton({ booking, unitNumber }) {
  const [state, setState] = useState('idle'); // idle | loading | sent

  const handleSend = async () => {
    setState('loading');
    try {
      const result = await sendWhatsAppConfirmation(booking, unitNumber);
      // Simulate webhook event after send
      simulateWebhookEvent(result.messages[0].id, booking.phone);
      setState('sent');
      setTimeout(() => setState('idle'), 4000);
    } catch (err) {
      setState('idle');
    }
  };

  if (state === 'sent') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
        <CheckCircle className="w-3.5 h-3.5" />
        Sent!
      </span>
    );
  }

  return (
    <Button
      variant="whatsapp"
      size="xs"
      icon={state === 'loading' ? Loader2 : MessageCircle}
      loading={state === 'loading'}
      onClick={handleSend}
    >
      <span className="hidden sm:inline">WhatsApp</span>
    </Button>
  );
}

export function BookingHistoryTab({ unit, onDeleteBooking, onViewDetails }) {
  const sortedBookings = [...(unit.bookings || [])].sort(
    (a, b) => parseISO(b.checkIn) - parseISO(a.checkIn)
  );

  if (sortedBookings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-500">
        <p className="text-lg font-semibold">No bookings yet</p>
        <p className="text-sm mt-1">Add the first booking for this unit.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 uppercase tracking-widest font-medium">
        {sortedBookings.length} Booking{sortedBookings.length !== 1 ? 's' : ''} (most recent first)
      </p>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-700/50">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800/60 border-b border-slate-700/50">
              {['Tenant', 'Phone', 'Source', 'Check-In', 'Check-Out', 'Amount', 'Action'].map((h) => (
                <th key={h} className="text-left text-xs font-semibold text-slate-400 px-4 py-3 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            {sortedBookings.map((booking) => {
              const isCurrent = booking.id === unit.currentBookingId;
              return (
                <tr
                  key={booking.id}
                  className={`transition-colors hover:bg-slate-800/30 ${
                    isCurrent ? 'bg-indigo-500/5 border-l-2 border-l-indigo-500' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500/60 to-violet-600/60 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-white">
                          {booking.tenantName.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-slate-200 text-sm">{booking.tenantName}</p>
                        {isCurrent && (
                          <p className="text-xs text-indigo-400 font-semibold">Current</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                      <Phone className="w-3 h-3" />
                      <span className="font-mono">{booking.phone}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <SourceTag source={booking.source} />
                  </td>
                  <td className="px-4 py-3 text-slate-300 text-xs">
                    {format(parseISO(booking.checkIn), 'MMM d, yyyy')}
                  </td>
                  <td className="px-4 py-3 text-slate-300 text-xs">
                    {format(parseISO(booking.checkOut), 'MMM d, yyyy')}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-semibold text-emerald-400">
                      SAR {booking.amount.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onViewDetails && onViewDetails(booking, unit)}
                        title="View & Edit Details"
                        className="p-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Details</span>
                      </button>
                      <WhatsAppButton booking={booking} unitNumber={unit.number} />
                      <button
                        onClick={() => onDeleteBooking && onDeleteBooking(unit.id, booking.id, booking.phone)}
                        title="Delete Booking"
                        className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {sortedBookings.map((booking) => {
          const isCurrent = booking.id === unit.currentBookingId;
          return (
            <div
              key={booking.id}
              className={`rounded-xl border p-4 space-y-3 ${
                isCurrent
                  ? 'bg-indigo-500/5 border-indigo-500/30'
                  : 'bg-slate-800/40 border-slate-700/40'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-200">{booking.tenantName}</p>
                  <p className="text-xs text-slate-500 font-mono">{booking.phone}</p>
                </div>
                <SourceTag source={booking.source} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                <div>
                  <p className="text-slate-600">Check-in</p>
                  <p className="text-slate-300">{format(parseISO(booking.checkIn), 'MMM d, yyyy')}</p>
                </div>
                <div>
                  <p className="text-slate-600">Check-out</p>
                  <p className="text-slate-300">{format(parseISO(booking.checkOut), 'MMM d, yyyy')}</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-emerald-400 font-bold">SAR {booking.amount.toLocaleString()}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onViewDetails && onViewDetails(booking, unit)}
                    title="View & Edit Details"
                    className="p-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Details</span>
                  </button>
                  <WhatsAppButton booking={booking} unitNumber={unit.number} />
                  <button
                    onClick={() => onDeleteBooking && onDeleteBooking(unit.id, booking.id, booking.phone)}
                    title="Delete Booking"
                    className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

