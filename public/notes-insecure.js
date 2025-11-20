// insecure notes page ajax helpers
// refs
// - fetch API https://www.w3schools.com/js/js_api_fetch.asp
// - URLSearchParams https://www.w3schools.com/jsref/api_urlsearchparams.asp
// - innerHTML https://www.w3schools.com/jsref/prop_html_innerhtml.asp
// - document.getElementById https://www.w3schools.com/jsref/met_document_getelementbyid.asp
// - textContent https://www.w3schools.com/jsref/prop_node_textcontent.asp
// - className https://www.w3schools.com/jsref/prop_html_classname.asp
// - createElement https://www.w3schools.com/jsref/met_document_createelement.asp
// - appendChild https://www.w3schools.com/jsref/met_node_appendchild.asp
// - addEventListener https://www.w3schools.com/jsref/met_document_addeventlistener.asp
// - preventDefault https://www.w3schools.com/jsref/event_preventdefault.asp

function $(id){ return document.getElementById(id) }

function setBanner(ok, msg){
  const el = $('banner')
  el.textContent = msg || ''
  el.className = `banner ${ok ? 'banner--success' : 'banner--error'}`
}

function li(html){
  const el = document.createElement('li')
  el.innerHTML = html // intentionally unsafe to demonstrate stored xss
  return el
}

async function loadNotes(){
  try{
    const r = await fetch('/api/insecure/notes')
    const j = await r.json()
    const ul = $('notes-list')
    ul.innerHTML = ''
    if(!j.ok || !j.items?.length){
      ul.appendChild(li('None'))
      return
    }
    j.items.forEach(n => {
      const row = `
        <div><b>#${n.id}</b> <b>${n.heading}</b> by <i>${n.owner}</i> <i>(${n.created_at})</i></div>
        <div>${n.content}</div>
        <div class="btn-row" style="margin-top:8px">
          <button data-edit="${n.id}">Edit</button>
          <button class="btn-secondary" data-del="${n.id}">Delete</button>
        </div>
      `
      const el = li(row)
      el.querySelector('[data-edit]').addEventListener('click', ()=> openEdit(n))
      el.querySelector('[data-del]').addEventListener('click', ()=> doDelete(n.id))
      ul.appendChild(el)
    })
  }catch{
    setBanner(false,'Network error loading notes')
  }
}

function openEdit(n){
  const ul = $('notes-list')
  ul.innerHTML = ''
  const el = li(`
    <div class="card stack" style="padding:12px">
      <label>Heading <input id="e-head" value="${n.heading}"></label>
      <label>Content <textarea id="e-body">${n.content}</textarea></label>
      <div class="btn-row">
        <button data-save="${n.id}">Save</button>
        <button class="btn-secondary" data-cancel>Cancel</button>
      </div>
    </div>
  `)
  el.querySelector('[data-cancel]').addEventListener('click', loadNotes)
  el.querySelector('[data-save]').addEventListener('click', async ()=>{
    const body = new URLSearchParams({ heading: $('e-head').value, content: $('e-body').value })
    const r = await fetch(`/api/insecure/notes/${n.id}`, { method:'PUT', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body })
    const j = await r.json()
    if(!j.ok){ setBanner(false, j.message||'Update failed'); return }
    setBanner(true, 'Updated')
    loadNotes()
  })
  ul.appendChild(el)
}

async function doDelete(id){
  if(!confirm('Delete this note?')) return
  const r = await fetch(`/api/insecure/notes/${id}`, { method:'DELETE' })
  const j = await r.json()
  if(!j.ok){ setBanner(false, j.message||'Delete failed'); return }
  setBanner(true, 'Deleted')
  loadNotes()
}

async function onSubmit(e){
  e.preventDefault()
  const data = new URLSearchParams()
  data.set('owner', $('owner').value)
  data.set('heading', $('heading').value)
  data.set('content', $('content').value)
  try{
    const r = await fetch('/api/insecure/notes', { method:'POST', headers:{ 'Content-Type':'application/x-www-form-urlencoded' }, body: data })
    const j = await r.json()
    if(!j.ok){ setBanner(false, j.message || 'Failed'); return }
    setBanner(true, j.message || 'Saved')
    $('content').value = ''
    $('heading').value = ''
    loadNotes()
  }catch{
    setBanner(false,'Network error saving note')
  }
}

window.addEventListener('DOMContentLoaded', ()=>{
  $('insecure-notes-form').addEventListener('submit', onSubmit)
  loadNotes()
})