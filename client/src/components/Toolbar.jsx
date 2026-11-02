import { Icon } from './Icons.jsx';

function Btn({ onClick, active, disabled, label, children }) {
  return (
    <button
      type="button"
      className={`tb-btn${active ? ' active' : ''}`}
      onMouseDown={(e) => e.preventDefault()} // keep editor focus/selection
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
    >
      {children}
    </button>
  );
}

const BLOCKS = [
  { value: 'p', label: 'Normal text' },
  { value: '1', label: 'Heading 1' },
  { value: '2', label: 'Heading 2' },
  { value: '3', label: 'Heading 3' },
];

export default function Toolbar({ editor, disabled }) {
  if (!editor) return <div className="toolbar" />;
  const c = () => editor.chain().focus();
  const level = [1, 2, 3].find((l) => editor.isActive('heading', { level: l }));

  return (
    <div className="toolbar" role="toolbar" aria-label="Formatting">
      <Btn label="Undo (Ctrl+Z)" onClick={() => c().undo().run()} disabled={disabled || !editor.can().undo()}>
        <Icon name="undo" size={18} />
      </Btn>
      <Btn label="Redo (Ctrl+Y)" onClick={() => c().redo().run()} disabled={disabled || !editor.can().redo()}>
        <Icon name="redo" size={18} />
      </Btn>
      <span className="tb-sep" />
      <select
        className="tb-select"
        aria-label="Text style"
        disabled={disabled}
        value={level ? String(level) : 'p'}
        onChange={(e) => {
          const v = e.target.value;
          if (v === 'p') c().setParagraph().run();
          else c().setHeading({ level: Number(v) }).run();
        }}
      >
        {BLOCKS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
      </select>
      <span className="tb-sep" />
      <Btn label="Bold (Ctrl+B)" active={editor.isActive('bold')} disabled={disabled} onClick={() => c().toggleBold().run()}>
        <b>B</b>
      </Btn>
      <Btn label="Italic (Ctrl+I)" active={editor.isActive('italic')} disabled={disabled} onClick={() => c().toggleItalic().run()}>
        <i className="serif">I</i>
      </Btn>
      <Btn label="Underline (Ctrl+U)" active={editor.isActive('underline')} disabled={disabled} onClick={() => c().toggleUnderline().run()}>
        <u>U</u>
      </Btn>
      <Btn label="Strikethrough" active={editor.isActive('strike')} disabled={disabled} onClick={() => c().toggleStrike().run()}>
        <s>S</s>
      </Btn>
      <span className="tb-sep" />
      <Btn label="Bulleted list" active={editor.isActive('bulletList')} disabled={disabled} onClick={() => c().toggleBulletList().run()}>
        <Icon name="bullets" size={18} />
      </Btn>
      <Btn label="Numbered list" active={editor.isActive('orderedList')} disabled={disabled} onClick={() => c().toggleOrderedList().run()}>
        <Icon name="numbers" size={18} />
      </Btn>
    </div>
  );
}
