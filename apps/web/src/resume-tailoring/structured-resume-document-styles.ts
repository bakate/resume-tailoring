import interFontUrl from '@fontsource/inter/files/inter-latin-400-normal.woff2?inline'
import loraFontUrl from '@fontsource/lora/files/lora-latin-400-normal.woff2?inline'

export const tailoredResumeDocumentStyles = `
@font-face{font-family:ResumeInter;src:url('${interFontUrl}') format('woff2');font-weight:400}
@font-face{font-family:ResumeLora;src:url('${loraFontUrl}') format('woff2');font-weight:400}
@page{size:A4;margin:12mm 14mm}
*{box-sizing:border-box}
body{margin:0;color:#151820;font:10.5pt/1.4 ResumeInter,sans-serif;overflow-wrap:anywhere}
.resume-page{width:182mm}
header{border-bottom:.5mm solid #164f3d;padding-bottom:4mm}
header.with-photo{display:grid;grid-template-columns:minmax(0,1fr) 24mm;column-gap:6mm;align-items:center}
.contact-detail{white-space:nowrap}
h1,h2{margin:0;color:#164f3d;font-family:ResumeLora,serif;font-weight:400}
h1{font-size:25pt}h2{font-size:14pt}h3{font-size:11pt;margin:0}
h1,h2,h3{break-after:avoid}.experience-heading{break-inside:avoid;break-after:avoid}
header p,address{margin:2mm 0 0;font-style:normal}
section{margin-top:4mm}article,.skill-group{margin-top:3mm}
article p,.skill-group p{margin:1mm 0 0}
.experience-organization{font-weight:600}.experience-dates{color:#505760;font-size:10pt;display:flex;justify-content:space-between;gap:12pt}.experience-location{text-align:right}
ul{margin:2mm 0 0;padding-left:5mm}li{margin-top:1.5mm;line-height:1.35;break-inside:avoid}
p{orphans:2;widows:2}
.resume-photo{width:24mm;height:24mm;object-fit:cover;border-radius:50%}
@media screen{body{padding:clamp(16px,5vw,68px);background:white}.resume-page{width:100%;max-width:182mm}}
`
