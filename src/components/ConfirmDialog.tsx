import { Component, Show } from 'solid-js';

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: Component<ConfirmDialogProps> = (props) => {
  const title = () => props.title || '请确认';
  const confirmText = () => props.confirmText || '确定';
  const cancelText = () => props.cancelText || '取消';

  return (
    <Show when={props.open}>
      <div
        class="confirm-dialog-overlay"
        style={{
          position: 'fixed',
          inset: 0,
          'background-color': 'rgba(0,0,0,0.4)',
          'z-index': 3000,
          display: 'flex',
          'align-items': 'center',
          'justify-content': 'center',
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) props.onCancel();
        }}
      >
        <div
          class="confirm-dialog"
          style={{
            'background-color': 'white',
            width: '320px',
            'max-width': '90vw',
            'border-radius': '10px',
            'box-shadow': '0 20px 25px -5px rgba(0,0,0,0.1)',
            overflow: 'hidden',
            display: 'flex',
            'flex-direction': 'column',
          }}
        >
          <div style={{ padding: '20px 24px 16px' }}>
            <div style={{ 'font-size': '16px', 'font-weight': 600, color: '#111827', 'margin-bottom': '10px' }}>
              {title()}
            </div>
            <div style={{ 'font-size': '13px', color: '#4B5563', 'line-height': 1.6 }}>
              {props.message}
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              'justify-content': 'flex-end',
              gap: '10px',
              padding: '12px 24px 16px',
              'border-top': '1px solid #F3F4F6',
            }}
          >
            <button
              type="button"
              onClick={props.onCancel}
              style={{
                padding: '6px 16px',
                'font-size': '13px',
                'border-radius': '6px',
                border: '1px solid #D1D5DB',
                background: 'white',
                color: '#111827',
                cursor: 'pointer',
              }}
            >
              {cancelText()}
            </button>
            <button
              type="button"
              onClick={props.onConfirm}
              style={{
                padding: '6px 16px',
                'font-size': '13px',
                'border-radius': '6px',
                border: '1px solid transparent',
                'background-color': props.danger ? '#EF4444' : '#E1251B',
                color: 'white',
                cursor: 'pointer',
              }}
            >
              {confirmText()}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default ConfirmDialog;
