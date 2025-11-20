// Reads location.hash and injects it unsafely using innerHTML
// W3Schools refs: location.hash https://www.w3schools.com/jsref/prop_loc_hash.asp
(function(){
  function render(){
    const raw = decodeURIComponent((location.hash || '').replace(/^#/, ''));
    document.getElementById('output').innerHTML = raw; // intentionally unsafe
  }
  window.addEventListener('hashchange', render);
  window.addEventListener('DOMContentLoaded', render);
})();
