export const questionnaireStyles = `
.loom-questionnaire{font:15px/1.6 system-ui,sans-serif;color:#182b49;max-width:880px;margin:auto}
.loom-questionnaire *{box-sizing:border-box}
.loom-questionnaire button{font:inherit;color:inherit;cursor:pointer}
.loom-questionnaire button:focus-visible{outline:3px solid #2563eb;outline-offset:3px}
.loom-questionnaire button:disabled{cursor:default;opacity:.45}
.loom-questionnaire-shell{background:#fff;border:1px solid #dbe3ee;border-radius:18px;overflow:hidden;box-shadow:0 12px 36px #182b4908}
.loom-questionnaire-toolbar{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 28px;border-bottom:1px solid #e8edf5}
.loom-questionnaire-brand{font-size:12px;font-weight:700;letter-spacing:1px;color:#53657e}
.loom-questionnaire-button{border:1px solid #cbd5e1;background:#fff;border-radius:9px;padding:8px 14px}
.loom-questionnaire-button:hover:not(:disabled){background:#f1f5fb;border-color:#7894bb}
.loom-questionnaire-body{padding:32px 36px}
.loom-questionnaire-progress{margin:0 0 10px;color:#53657e;font-size:13px}
.loom-questionnaire-heading{font-size:26px;line-height:1.4;margin:0 0 24px;overflow-wrap:anywhere}
.loom-questionnaire-heading:focus{outline:none}
.loom-questionnaire-choices{display:grid;gap:12px}
.loom-questionnaire-choice{display:flex;align-items:center;gap:14px;text-align:left;width:100%;padding:16px 18px;border:1px solid #dbe3ee;border-radius:12px;background:#fff;transition:background .15s,border-color .15s}
.loom-questionnaire-choice:hover:not(:disabled){background:#f5f8ff;border-color:#7894bb}
.loom-questionnaire-choice[aria-pressed=true]{background:#eef4ff;border-color:#2563eb}
.loom-questionnaire-choice-number{display:grid;place-items:center;flex:none;width:28px;height:28px;border-radius:8px;background:#eef4ff;color:#53657e;font-size:13px}
.loom-questionnaire-choice-text{flex:1;overflow-wrap:anywhere}
.loom-questionnaire-choice-selected{font-size:12px;color:#2563eb;flex:none}
.loom-questionnaire-footer{padding:18px 28px;border-top:1px solid #e8edf5;background:#fafbfd}
.loom-questionnaire-actions{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
.loom-questionnaire-review:empty{display:none}
.loom-questionnaire-review:not(:empty){margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid #e8edf5}
.loom-questionnaire-footer>.loom-questionnaire-feedback{padding:0;margin-top:12px}
.loom-questionnaire-result{padding:24px;background:#edf8f0;border:1px solid #bcdcc6;border-radius:12px;margin:0}
.loom-questionnaire-result .loom-questionnaire-heading{margin:0;color:#245d38}
.loom-questionnaire-history-title{font-size:14px;margin:0 0 10px;color:#53657e}
.loom-questionnaire-summary{padding-left:24px;margin:0}
.loom-questionnaire-summary button{border:0;background:none;padding:6px 0;text-align:left;color:#53657e;overflow-wrap:anywhere}
.loom-questionnaire-summary button:hover{color:#2563eb;text-decoration:underline}
.loom-questionnaire-feedback{font-size:13px;color:#b45309;margin:0;padding:0 28px}
.loom-questionnaire-feedback:empty{display:none}
.loom-questionnaire-flow{width:min(1080px,calc(100vw - 32px));max-width:none;max-height:calc(100vh - 32px);padding:0;border:1px solid #dbe3ee;border-radius:16px;background:#fff;color:#182b49;overflow:auto;box-shadow:0 24px 80px #182b4933}
.loom-questionnaire-flow::backdrop{background:#0f172a80}
.loom-questionnaire-flow-header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 24px;border-bottom:1px solid #e8edf5}
.loom-questionnaire-flow-header h2{font-size:20px;margin:0}
.loom-questionnaire-flow-hint{font-size:13px;color:#53657e;padding:14px 24px;margin:0}
.loom-questionnaire-flow-content{padding:0 24px 20px}
.loom-questionnaire-flow-steps{list-style:none;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:12px;margin:16px 0 0}
.loom-questionnaire-flow-steps>li{display:flex;min-width:0}
.loom-questionnaire-flow-step{display:flex;flex-direction:column;gap:8px;width:100%;min-height:112px;text-align:left;border:1px solid #cbd5e1;background:#f5f8ff;border-radius:12px;padding:14px 16px;overflow-wrap:anywhere}
.loom-questionnaire-flow-step:hover{border-color:#7894bb;background:#eef4ff}
.loom-questionnaire-flow-step-meta{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:12px;color:#53657e}
.loom-questionnaire-flow-step-title{display:block;font-size:14px;font-weight:600;line-height:1.5}
.loom-questionnaire-flow-step-answer{display:grid;gap:4px;margin-top:auto;padding-top:10px;border-top:1px solid #dbe3ee}
.loom-questionnaire-flow-step-caption{font-size:11px;color:#53657e}
.loom-questionnaire-flow-step-value{font-size:13px;line-height:1.5;color:#182b49}
.loom-questionnaire-flow-step[data-kind=result]{background:#edf8f0;border-color:#bcdcc6}
.loom-questionnaire-flow-step[aria-current=step]{border-color:#d97706;background:#fff3db}
.loom-questionnaire-flow-step-current{color:#b45309;font-size:11px;white-space:nowrap}
.loom-questionnaire-flow-step[aria-current=step] .loom-questionnaire-flow-step-answer{border-color:#f2d7a9}
@media(max-width:600px){.loom-questionnaire-toolbar,.loom-questionnaire-footer{padding:16px 18px}.loom-questionnaire-body{padding:24px 18px}.loom-questionnaire-heading{font-size:22px}.loom-questionnaire-choice{padding:13px 12px}.loom-questionnaire-flow-header{padding:16px}.loom-questionnaire-flow-content{padding:0 12px 16px}.loom-questionnaire-flow-hint{padding:12px 16px}}
`;
