"use client";

import { BOT_CATALOG, type BotInfo } from "./BotSubscribeDialog";

export default function BotGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {BOT_CATALOG.map((bot) => (
        <BotCard key={bot.strategy} bot={bot} />
      ))}
    </div>
  );
}

function BotCard({ bot }: { bot: BotInfo }) {
  return (
    <div className="relative bg-bg-surface border border-border-default rounded-xl p-6 card-hover flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-text-primary font-semibold">{bot.name}</h3>
        <span
          className={`${bot.tagColor} text-[10px] font-mono-numbers font-bold uppercase tracking-wider px-2 py-0.5 rounded-full`}
        >
          {bot.tag}
        </span>
      </div>
      <p className="text-text-secondary text-sm leading-relaxed mb-4 flex-1">
        {bot.description}
      </p>
      <div className="flex flex-wrap gap-2 mb-4">
        {bot.traits.map((trait) => (
          <span
            key={trait}
            className="text-[11px] text-text-muted bg-bg-elevated px-2 py-1 rounded"
          >
            {trait}
          </span>
        ))}
      </div>

      <div className="border-t border-border-default pt-4 mt-auto">
        <div className="flex items-center justify-between">
          <span className="text-text-muted text-xs">Hire in lobby — buy-in cost applies</span>
          <span className="px-4 py-2 bg-safety-cyan/10 border border-safety-cyan/30 text-safety-cyan text-xs font-bold rounded-lg uppercase tracking-wider">
            Free
          </span>
        </div>
      </div>
    </div>
  );
}
