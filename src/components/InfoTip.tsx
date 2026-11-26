import { useState } from 'react';
import { ClickAwayListener, Tooltip } from '@mui/material';
import { InfoOutlined } from '@mui/icons-material';

/*
 * 짧은 설명 팝업 (2026-11-24, 루치오: "각각의 항목별로 설명팝업이 짧게 나오는 것도 좋지 않을까").
 * One or two sentences next to a menu item, a section title or a field. Hover or focus on PC, tap on phones;
 * tap outside or press Escape to close. Never carries data, only how to use the screen.
 */
export default function InfoTip({ label, text, tone = 'light' }: { label: string; text: string; tone?: 'light' | 'dark' }) {
  const [open, setOpen] = useState(false);
  return <ClickAwayListener onClickAway={() => setOpen(false)}>
    <span className="info-tip-wrap">
      <Tooltip title={text} open={open} onClose={() => setOpen(false)} onOpen={() => setOpen(true)} arrow placement="bottom-start"
        enterTouchDelay={0} leaveTouchDelay={6000} slotProps={{ tooltip: { className: 'info-tip-bubble' } }}>
        <button type="button" className={`info-tip tone-${tone}`} aria-label={`${label} 설명`} onClick={(event) => { event.preventDefault(); event.stopPropagation(); setOpen((value) => !value); }}>
          <InfoOutlined />
        </button>
      </Tooltip>
    </span>
  </ClickAwayListener>;
}
