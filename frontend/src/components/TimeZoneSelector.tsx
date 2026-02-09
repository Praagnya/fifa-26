import { useTimeZone } from '../hooks/useTimeZone';

interface TimeZoneSelectorProps {
  className?: string;
}

export default function TimeZoneSelector({ className = '' }: TimeZoneSelectorProps) {
  const { userTimeZone, timeZoneInfo, updateTimeZone, availableTimezones } = useTimeZone();

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg 
        className="w-4 h-4 text-white/50" 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor" 
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <select
        value={userTimeZone}
        onChange={(e) => {
          console.log('Timezone selected:', e.target.value);
          updateTimeZone(e.target.value);
        }}
        className="bg-transparent text-xs text-white/70 border border-white/10 rounded px-2 py-1 focus:outline-none focus:border-indigo-500/50 cursor-pointer"
      >
        {availableTimezones.map((tz) => (
          <option key={tz} value={tz} className="bg-[#1a1a24] text-white">
            {tz.replace('_', ' ')}
          </option>
        ))}
      </select>
      {!timeZoneInfo.isUTC && (
        <span className="text-xs text-white/50">
          UTC{timeZoneInfo.offsetHours}
        </span>
      )}
    </div>
  );
}