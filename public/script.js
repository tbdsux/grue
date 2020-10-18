btnCopy = document.getElementById('btn')

btnCopy.onclick = function () {
  // set the text for notification
  btnCopy.innerText = 'copied'

  // copy from the aria-label
  new ClipboardJS('#btn', {
    text: function (trigger) {
      return trigger.getAttribute('aria-label')
    },
  })
}
