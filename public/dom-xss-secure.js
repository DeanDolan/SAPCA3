// Reads location.hash and injects it safely using textContent
// W3Schools refs: location.hash https://www.w3schools.com/jsref/prop_loc_hash.asp
// textContent https://www.w3schools.com/jsref/prop_node_textcontent.asp
(function(){
  function render(){
    const raw = decodeURIComponent((location.hash || '').replace(/^#/, ''));
    document.getElementById('output').textContent = raw; // safe encoding by browser
  }
  window.addEventListener('hashchange', render);
  window.addEventListener('DOMContentLoaded', render);
})();
