// secure login and register client script with redirect to securenotes.html
// refs used
// - DOMContentLoaded https://www.w3schools.com/jsref/event_domcontentloaded.asp
// - document.getElementById https://www.w3schools.com/jsref/met_document_getelementbyid.asp
// - addEventListener https://www.w3schools.com/jsref/met_element_addeventlistener.asp
// - fetch API https://www.w3schools.com/js/js_api_fetch.asp
// - FormData https://www.w3schools.com/jsref/api_formdata.asp
// - URLSearchParams https://www.w3schools.com/jsref/api_urlsearchparams.asp
// - textContent https://www.w3schools.com/jsref/prop_node_textcontent.asp
// - className https://www.w3schools.com/jsref/prop_html_classname.asp
// - RegExp test https://www.w3schools.com/jsref/jsref_regexp_test.asp
// - toLowerCase https://www.w3schools.com/jsref/jsref_tolowercase.asp
// - template literals https://www.w3schools.com/js/js_string_templates.asp
// - window.location.href https://www.w3schools.com/jsref/prop_loc_href.asp

// wait until the HTML is parsed so elements exist
window.addEventListener('DOMContentLoaded', ()=>{
  // tiny selector helper for brevity
  const $ = id => document.getElementById(id)

  // show a status banner for success or error
  const show = (id, ok, msg)=>{
    const el = $(id)
    el.textContent = msg
    el.className = `banner ${ok ? 'banner--success' : 'banner--error'}`
  }

  // client password policy check mirrors the server rules for fast feedback
  function strong(p, u){
    const t = (p || '').trim()
    if(t.length < 12) return 'at least 12 characters'
    if(!/[a-z]/.test(t)) return 'add lowercase'
    if(!/[A-Z]/.test(t)) return 'add uppercase'
    if(!/[0-9]/.test(t)) return 'add number'
    if(!/[^A-Za-z0-9]/.test(t)) return 'add symbol'
    if(u && t.toLowerCase().includes(String(u).toLowerCase())) return 'must not include username'
    return ''
  }

  // submit a login or register form using fetch and update the banner
  async function post(formId, bannerId){
    const form = $(formId)
    const endpoint = form.dataset.endpoint

    // build x-www-form-urlencoded body from form fields
    const data = new URLSearchParams(new FormData(form))

    // extra checks for secure registration form
    if(formId === 'form-secure-register'){
      const u = data.get('username')
      const p1 = document.getElementById('s-p1').value
      const p2 = document.getElementById('s-p2').value
      if(p1 !== p2){ show(bannerId, false, 'Passwords do not match'); return }
      const err = strong(p1, u)
      if(err){ show(bannerId, false, 'Weak password: ' + err); return }
    }

    try{
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: data
      })
      const j = await r.json()
      show(bannerId, j.ok, j.message || (j.ok ? 'OK' : 'Error'))

      // on successful secure login go to secure notes page
      if(j.ok && formId === 'form-secure-login'){
        window.location.href = '/securenotes.html'
      }
    }catch{
      show(bannerId, false, 'Network error')
    }
  }

  // bind buttons to submit handlers
  document.getElementById('btn-secure-login')
    .addEventListener('click', ()=> post('form-secure-login', 'banner-secure-login'))
  document.getElementById('btn-secure-register')
    .addEventListener('click', ()=> post('form-secure-register', 'banner-secure-register'))
})
