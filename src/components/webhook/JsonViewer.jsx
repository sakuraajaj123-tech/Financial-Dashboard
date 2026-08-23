import { useState } from 'react';
import { ChevronRight, ChevronDown, Copy, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

function JsonNode({ data, keyName, isLast = true, depth = 0 }) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);

  const isObject = data !== null && typeof data === 'object' && !Array.isArray(data);
  const isArray = Array.isArray(data);
  const isExpandable = isObject || isArray;

  const toggle = () => setCollapsed(!collapsed);

  // Render Primitive values
  if (!isExpandable) {
    let valueElement;
    if (typeof data === 'string') {
      valueElement = <span className="text-emerald-400">"{data}"</span>;
    } else if (typeof data === 'number') {
      valueElement = <span className="text-amber-400">{data}</span>;
    } else if (typeof data === 'boolean') {
      valueElement = <span className="text-purple-400">{String(data)}</span>;
    } else if (data === null) {
      valueElement = <span className="text-rose-400 font-semibold">null</span>;
    } else {
      valueElement = <span className="text-slate-400">{String(data)}</span>;
    }

    return (
      <div className="font-mono text-xs leading-relaxed py-0.5 hover:bg-slate-800/40 rounded px-1 -mx-1">
        {keyName !== undefined && (
          <span className="text-sky-300 mr-1.5">"{keyName}":</span>
        )}
        {valueElement}
        {!isLast && <span className="text-slate-500">,</span>}
      </div>
    );
  }

  // Render Object or Array
  const entries = isArray ? data : Object.entries(data);
  const openBracket = isArray ? '[' : '{';
  const closeBracket = isArray ? ']' : '}';
  const count = isArray ? data.length : Object.keys(data).length;

  return (
    <div className="font-mono text-xs leading-relaxed">
      <div
        className="inline-flex items-center gap-1 cursor-pointer select-none hover:bg-slate-800/60 rounded px-1 -mx-1 text-slate-300"
        onClick={toggle}
      >
        <span className="text-slate-500 hover:text-slate-300">
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </span>

        {keyName !== undefined && (
          <span className="text-sky-300">"{keyName}": </span>
        )}

        <span className="text-slate-400">{openBracket}</span>

        {collapsed && (
          <span className="text-slate-500 text-[11px] italic px-1 bg-slate-800/50 rounded border border-slate-700/50">
            {count} {isArray ? t('jsonViewer.items') : t('jsonViewer.keys')}
          </span>
        )}

        {collapsed && <span className="text-slate-400">{closeBracket}</span>}
        {collapsed && !isLast && <span className="text-slate-500">,</span>}
      </div>

      {!collapsed && (
        <div className="pl-4 border-l border-slate-700/40 ml-1.5 my-0.5 space-y-0.5">
          {isArray
            ? data.map((item, idx) => (
                <JsonNode
                  key={idx}
                  data={item}
                  isLast={idx === data.length - 1}
                  depth={depth + 1}
                />
              ))
            : entries.map(([k, v], idx) => (
                <JsonNode
                  key={k}
                  keyName={k}
                  data={v}
                  isLast={idx === entries.length - 1}
                  depth={depth + 1}
                />
              ))}
        </div>
      )}

      {!collapsed && (
        <div>
          <span className="text-slate-400">{closeBracket}</span>
          {!isLast && <span className="text-slate-500">,</span>}
        </div>
      )}
    </div>
  );
}

export function JsonViewer({ data }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700/60 transition-all text-xs flex items-center gap-1 z-10 opacity-80 group-hover:opacity-100"
        title="Copy JSON"
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-emerald-400">{t('jsonViewer.copied')}</span>
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5" />
            <span>{t('jsonViewer.copy')}</span>
          </>
        )}
      </button>
      <div className="overflow-x-auto p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
        <JsonNode data={data} isLast={true} />
      </div>
    </div>
  );
}
