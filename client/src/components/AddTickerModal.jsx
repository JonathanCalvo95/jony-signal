import { useState, useEffect, useRef } from 'react';
import { X, Plus, Search, TrendingUp, DollarSign, Wand2, Building2, Globe } from 'lucide-react';
import { previewTicker, getCatalog } from '../api/watchlistApi.js';

export default function AddTickerModal({ onAdd, onClose }) {
  const [ticker,      setTicker]      = useState('');
  const [targetBuy,   setTargetBuy]   = useState('');
  const [targetSell,  setTargetSell]  = useState('');
  const [error,       setError]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [autoLoading, setAutoLoading] = useState(false);
  const [catalog,     setCatalog]     = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const inputRef = useRef(null);
  const suggestRef = useRef(null);

  // Load catalog once on mount
  useEffect(() => {
    getCatalog().then(setCatalog).catch(() => {});
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Close suggestions on outside click
  useEffect(() => {
    function onClick(e) {
      if (suggestRef.current && !suggestRef.current.contains(e.target)) {
        setShowSuggest(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function handleTickerInput(val) {
    const upper = val.toUpperCase();
    setTicker(upper);
    setError('');
    if (upper.length < 1) {
      setSuggestions([]);
      setShowSuggest(false);
      return;
    }
    const q = upper.toLowerCase();
    const matches = catalog
      .filter(
        (item) =>
          item.ticker.toLowerCase().startsWith(q) ||
          item.yahoo.toLowerCase().startsWith(q) ||
          item.nombre.toLowerCase().includes(q)
      )
      .slice(0, 8);
    setSuggestions(matches);
    setShowSuggest(matches.length > 0);
  }

  function selectSuggestion(item) {
    setTicker(item.yahoo);
    setSuggestions([]);
    setShowSuggest(false);
    setError('');
  }

  async function handleAutoFill() {
    if (!ticker.trim()) return setError('Ingresá un ticker primero');
    setError('');
    setAutoLoading(true);
    try {
      const data = await previewTicker(ticker.trim().toUpperCase());
      if (!data.autoTargets) throw new Error('No hay datos de 52W para calcular');
      setTargetBuy(String(data.autoTargets.targetBuy));
      setTargetSell(String(data.autoTargets.targetSell));
    } catch (e) {
      setError(e.message);
    } finally {
      setAutoLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!ticker.trim()) return setError('Ingresá un símbolo de ticker');
    if (targetBuy && targetSell && Number(targetSell) <= Number(targetBuy))
      return setError('Target Sell debe ser mayor que Target Buy');

    setLoading(true);
    try {
      await onAdd(
        ticker.trim().toUpperCase(),
        targetBuy  ? Number(targetBuy)  : null,
        targetSell ? Number(targetSell) : null,
      );
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(4,8,20,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="fade-in w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-lg"
              style={{ background: 'rgba(59,130,246,0.12)' }}
            >
              <Plus size={15} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-[15px]">Agregar Ticker</h2>
              <p className="text-gray-600 text-[11px]">CEDEARs, acciones y ETFs</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-white/[0.05] transition-all"
          >
            <X size={15} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">

          {/* Ticker input with autocomplete */}
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">
              Símbolo
            </label>
            <div className="relative" ref={suggestRef}>
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600 z-10" />
              <input
                ref={inputRef}
                type="text"
                value={ticker}
                onChange={(e) => handleTickerInput(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowSuggest(true)}
                placeholder="Ej: AAPL, GGAL, SPY, QQQ..."
                className="input-dark pl-9 font-mono tracking-wide uppercase"
                autoComplete="off"
              />

              {/* Suggestions dropdown */}
              {showSuggest && (
                <div
                  className="absolute left-0 right-0 top-full mt-1 rounded-xl overflow-hidden z-50 shadow-2xl"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}
                >
                  {suggestions.map((item) => (
                    <button
                      key={item.yahoo}
                      type="button"
                      onClick={() => selectSuggestion(item)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/[0.05] transition-colors"
                    >
                      <div
                        className="flex items-center justify-center w-6 h-6 rounded shrink-0"
                        style={{
                          background: item.tipo === 'cedear'
                            ? 'rgba(59,130,246,0.12)'
                            : 'rgba(34,212,122,0.10)',
                        }}
                      >
                        {item.tipo === 'cedear'
                          ? <Globe size={11} className="text-blue-400" />
                          : <Building2 size={11} className="text-green-400" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="font-mono text-[13px] font-semibold text-white">
                            {item.ticker !== item.yahoo ? `${item.ticker} → ${item.yahoo}` : item.ticker}
                          </span>
                          <span
                            className="text-[9px] uppercase font-medium px-1 py-0.5 rounded"
                            style={{
                              background: item.tipo === 'cedear'
                                ? 'rgba(59,130,246,0.15)'
                                : 'rgba(34,212,122,0.12)',
                              color: item.tipo === 'cedear' ? '#60a5fa' : '#22d47a',
                            }}
                          >
                            {item.tipo === 'cedear' ? 'CEDEAR' : 'Acción'}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 truncate">{item.nombre}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Auto-calculate button */}
          <button
            type="button"
            onClick={handleAutoFill}
            disabled={autoLoading || !ticker.trim()}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-[12px] font-medium transition-all"
            style={{
              background: 'rgba(167,139,250,0.08)',
              border: '1px solid rgba(167,139,250,0.2)',
              color: ticker.trim() ? 'rgba(167,139,250,0.9)' : 'rgba(167,139,250,0.3)',
            }}
          >
            {autoLoading
              ? <span className="w-3 h-3 border border-purple-400/40 border-t-purple-400 rounded-full animate-spin" />
              : <Wand2 size={13} />
            }
            {autoLoading ? 'Calculando...' : 'Auto-calcular targets (52W range)'}
          </button>

          {/* Targets row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider mb-1.5" style={{ color: 'var(--green)' }}>
                Target Buy
              </label>
              <div className="relative">
                <DollarSign size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                <input
                  type="number"
                  value={targetBuy}
                  onChange={(e) => setTargetBuy(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  className="input-dark pl-8 font-mono"
                  style={{ borderColor: targetBuy ? 'rgba(34,212,122,0.3)' : undefined }}
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider mb-1.5" style={{ color: 'var(--red)' }}>
                Target Sell
              </label>
              <div className="relative">
                <DollarSign size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                <input
                  type="number"
                  value={targetSell}
                  onChange={(e) => setTargetSell(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  className="input-dark pl-8 font-mono"
                  style={{ borderColor: targetSell ? 'rgba(240,78,106,0.3)' : undefined }}
                />
              </div>
            </div>
          </div>

          {/* Range preview */}
          {targetBuy && targetSell && Number(targetSell) > Number(targetBuy) && (
            <div
              className="flex items-center justify-between px-3 py-2 rounded-lg text-[12px] font-mono"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
            >
              <span style={{ color: 'var(--green)' }}>${Number(targetBuy).toFixed(2)}</span>
              <div className="flex-1 mx-2 h-px" style={{ background: 'linear-gradient(90deg, var(--green), var(--red))' }} />
              <span style={{ color: 'var(--red)' }}>${Number(targetSell).toFixed(2)}</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-[13px] text-red-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg text-[13px] font-medium text-gray-400 hover:text-gray-200 hover:bg-white/[0.05] transition-all"
              style={{ border: '1px solid var(--border-subtle)' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 btn-primary flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  <TrendingUp size={14} />
                  Agregar
                </>
              )}
            </button>
          </div>
        </form>

        {/* Footer hint */}
        <div
          className="px-5 py-2.5 text-center text-[11px]"
          style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
        >
          <kbd className="px-1 py-0.5 rounded text-[10px] bg-white/[0.06]">Esc</kbd> para cerrar · Targets opcionales
        </div>
      </div>
    </div>
  );
}
