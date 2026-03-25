import { useState, useRef, useEffect } from 'react';
import { Pencil, Check } from 'lucide-react';

export default function EditableCell({ value, onSave, placeholder = '--' }) {
  const [editing, setEditing] = useState(false);
  const [input, setInput]     = useState('');
  const [saved,  setSaved]    = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  function startEdit() {
    setInput(value != null ? String(value) : '');
    setEditing(true);
  }

  function commit() {
    const num = parseFloat(input);
    if (!isNaN(num) && num > 0 && num !== value) {
      onSave(num);
      setSaved(true);
      setTimeout(() => setSaved(false), 1200);
    }
    setEditing(false);
  }

  function onKeyDown(e) {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center justify-end gap-1">
        <input
          ref={inputRef}
          type="number"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onBlur={commit}
          onKeyDown={onKeyDown}
          className="w-24 bg-[#0a1628] border border-blue-500/60 text-white text-right px-2 py-1 rounded-lg text-[13px] font-mono outline-none shadow-[0_0_0_3px_rgba(59,130,246,0.15)]"
        />
      </div>
    );
  }

  if (value == null) {
    return (
      <button
        onClick={startEdit}
        className="text-right w-full text-[13px] font-mono text-gray-600 hover:text-blue-400 transition-colors group flex items-center justify-end gap-1"
      >
        <span>{placeholder}</span>
        <Pencil size={10} className="opacity-0 group-hover:opacity-60 transition-opacity" />
      </button>
    );
  }

  return (
    <button
      onClick={startEdit}
      className={`text-right w-full font-mono text-[13px] transition-colors group flex items-center justify-end gap-1.5 ${
        saved ? 'text-green-400' : 'text-gray-200 hover:text-blue-400'
      }`}
    >
      {saved ? <Check size={11} className="text-green-400" /> : null}
      <span>${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      {!saved && (
        <Pencil size={10} className="opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
      )}
    </button>
  );
}
