// insecure login and register client script with redirect to insecurenotes.html
// refs used
// - DOMContentLoaded https://www.w3schools.com/jsref/event_domcontentloaded.asp
// - document.getElementById https://www.w3schools.com/jsref/met_document_getelementbyid.asp
// - addEventListener https://www.w3schools.com/jsref/met_element_addeventlistener.asp
// - fetch API https://www.w3schools.com/js/js_api_fetch.asp
// - FormData https://www.w3schools.com/jsref/api_formdata.asp
// - URLSearchParams https://www.w3schools.com/jsref/api_urlsearchparams.asp
// - textContent https://www.w3schools.com/jsref/prop_node_textcontent.asp
// - className https://www.w3schools.com/jsref/prop_html_classname.asp
// - template literals https://www.w3schools.com/js/js_string_templates.asp
// - window.location.href https://www.w3schools.com/jsref/prop_loc_href.asp

window.addEventListener('DOMContentLoaded', ()=>{
  const $ = id => document.getElementById(id)

  // quick visual feedback for success or error banners
  const show = (id, ok, msg)=>{
    const el = $(id)
    el.textContent = msg
    el.className = `banner ${ok ? 'banner--success' : 'banner--error'}`
  }

  // submit login or register and reflect server result
  async function post(formId, bannerId){
    const form = $(formId)
    const endpoint = form.dataset.endpoint

    // use URLSearchParams to match x-www-form-urlencoded expected by server
    const body = new URLSearchParams(new FormData(form))

    try{
      const r = await fetch(endpoint, {
        method:'POST',
        headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
        body
      })
      const j = await r.json()
      show(bannerId, j.ok, j.message || (j.ok ? 'OK' : 'Error'))

      // redirect on successful insecure login to demonstrate separate notes area
      if(j.ok && formId === 'form-insecure-login'){
        window.location.href = '/insecurenotes.html'
      }
    }catch{
      // friendly error when the network or server is unreachable
      show(bannerId, false, 'Network error')
    }
  }

  $('btn-insecure-login').addEventListener('click', ()=> post('form-insecure-login', 'banner-insecure-login'))
  $('btn-insecure-register').addEventListener('click', ()=> post('form-insecure-register', 'banner-insecure-register'))
})
