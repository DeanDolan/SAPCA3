// AJAX secure notes with create edit delete
// refs
// - fetch API https://www.w3schools.com/js/js_api_fetch.asp
// - URLSearchParams https://www.w3schools.com/jsref/api_urlsearchparams.asp
// - addEventListener https://www.w3schools.com/jsref/met_document_addeventlistener.asp
// - innerHTML https://www.w3schools.com/jsref/prop_html_innerhtml.asp
// - textContent https://www.w3schools.com/jsref/prop_node_textcontent.asp

window.addEventListener('DOMContentLoaded', ()=>{
  const list = document.getElementById('secure-list')
  const form = document.getElementById('secure-notes-form')
  const heading = document.getElementById('secure-heading')
  const content = document.getElementById('secure-content')
  const banner = document.getElementById('secure-banner')
  const idField = document.getElementById('note-id')
  const btnCancel = document.getElementById('btn-cancel')

  const esc = s => String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;')

  function show(ok,msg){
    banner.textContent = msg || (ok ? 'OK' : 'Error')
    banner.className = `banner ${ok ? 'banner--success' : 'banner--error'}`
  }

  async function load(){
    try{
      const r = await fetch('/api/secure/notes',{ credentials:'same-origin' })
      if(r.status===401){ show(false,'Login required'); list.innerHTML = '<li>Login required</li>'; return }
      const j = await r.json()
      const items = j.items || []
      if(!items.length){ list.innerHTML = '<li>None</li>'; return }
      list.innerHTML = items.map(n => `
        <li data-id="${n.id}">
          <div class="note-row">
            <div class="note-main">
              <div class="note-heading">${esc(n.heading)}</div>
              <div class="note-content">${esc(n.content)}</div>
              <div class="note-meta"><i>${n.created_at}</i></div>
            </div>
            <div class="note-actions">
              <button type="button" class="btn-edit">Edit</button>
              <button type="button" class="btn-delete">Delete</button>
            </div>
          </div>
        </li>
      `).join('')
    }catch{
      show(false,'Network error')
    }
  }

  async function createOrUpdate(e){
    e.preventDefault()
    const h = (heading.value||'').trim()
    const c = (content.value||'').trim()
    if(!h || !c){ show(false,'Heading and content required'); return }

    const currentId = idField.value
    const body = new URLSearchParams({ heading: h, content: c })

    try{
      let r
      if(currentId){
        r = await fetch(`/api/secure/notes/${currentId}`, {
          method:'PUT',
          headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
          credentials:'same-origin',
          body
        })
      }else{
        r = await fetch('/api/secure/notes', {
          method:'POST',
          headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
          credentials:'same-origin',
          body
        })
      }

      if(r.status===401){ show(false,'Login required'); return }
      const j = await r.json()
      if(!j.ok){ show(false, j.message || 'Failed'); return }
      show(true, currentId ? 'Updated' : 'Saved')
      idField.value = ''
      heading.value = ''
      content.value = ''
      await load()
    }catch{
      show(false,'Network error')
    }
  }

  function startEdit(li){
    const id = li.getAttribute('data-id')
    const h = li.querySelector('.note-heading')?.textContent || ''
    const c = li.querySelector('.note-content')?.textContent || ''
    idField.value = id
    heading.value = h
    content.value = c
    show(true,'Editing note')
  }

  async function doDelete(li){
    const id = li.getAttribute('data-id')
    if(!confirm('Delete this note')) return
    try{
      const r = await fetch(`/api/secure/notes/${id}`, { method:'DELETE', credentials:'same-origin' })
      if(r.status===401){ show(false,'Login required'); return }
      const j = await r.json()
      if(!j.ok){ show(false, j.message || 'Failed'); return }
      show(true,'Deleted')
      await load()
    }catch{
      show(false,'Network error')
    }
  }

  list.addEventListener('click', (e)=>{
    const li = e.target.closest('li[data-id]')
    if(!li) return
    if(e.target.classList.contains('btn-edit')) startEdit(li)
    if(e.target.classList.contains('btn-delete')) doDelete(li)
  })

  btnCancel.addEventListener('click', ()=>{
    idField.value = ''
    heading.value = ''
    content.value = ''
    show(true,'Edit cancelled')
  })

  form.addEventListener('submit', createOrUpdate)

  load()
})
