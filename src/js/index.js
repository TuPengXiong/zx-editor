/**
 * Create by zx1984
 * 2018/1/23 0023.
 * https://github.com/zx1984
 */
import '../css/zx-editor.styl'
import '../css/bottom-modal.styl'
import {
  initMixin,
  TEXT_STYLE_HEIGHT
} from './init'
import {
  initEvent,
  checkContentInnerNull,
  removeContentClass } from './event'
import { initEmoji } from './emoji/index'
import { initTextStyle } from './text-style/index'
import util from './util/index'
import dom from './util/dom-core'
import imgHandler from './image'

class ZxEditor {
  /**
   * constructor
   * @param selector
   * @param options
   * @constructor
   */
  constructor (selector, options) {
    if (this instanceof ZxEditor) {
      this._init(selector, options)
    } else {
      throw new Error('ZxEditor is a constructor and should be called with the `new` keyword')
    }
  }

  /**
   * 初始化
   * @param selector
   * @param options
   * @private
   */
  _init (selector, options) {
    // 初始化dom、参数
    initMixin(this, selector, options)
    // 自定义事件
    this._events = {}
    // 初始化 emojiModal
    initEmoji(this)
    // 初始化 textStyleModal
    initTextStyle(this)
    // 初始化事件
    initEvent(this)
    // 扩展属性
    this.toBlobData = imgHandler.toBlobData
    this.filesToBase64 = imgHandler.filesToBase64
  }

  /**
   * 注册自定义事件
   * @param notifyName 通知名称
   * @param callback 回调函数
   * @returns {ZxEditor}
   */
  on (notifyName, callback) {
    if(typeof notifyName === 'string' && typeof callback === 'function') {
      this._events[notifyName] = {
        fun: callback
      }
    }
    return this
  }

  /**
   * 派发事件
   * @param notifyName
   * @returns {ZxEditor}
   */
  emit (notifyName) {
    const ev = this._events[notifyName]
    const args = util.slice(arguments, 1)
    try {
      this.debug.log(notifyName, args)
      ev.fun.apply(null, args)
    } catch (e) {
      this.debug.error(notifyName, e)
    }
    return this
  }

  /**
   * 向文档中添加图片
   * @param src
   */
  addImage (src) {
    console.log('$cursorElm', this.$cursorElm)
    imgHandler.create(src, (err, $img) => {
      if (err) {
        this.debug.add('addImage', e)
        return
      }
      // 将图片插入至合适位置
      this.$cursorElm = dom.insertToRangeElm($img, this.$cursorElm, 'child-node-is-img')
      // 重置光标位置
      this.cursor.setRange(this.$cursorElm, 0)
      // 延时执行光标所在元素位置计算
      let timer = setTimeout(_ => {
        this.checkCursorPosition()
        clearTimeout(timer)
        timer = null
      }, 300)
    })
  }

  /**
   * 添加链接
   * @param title
   * @param url
   */
  addLink (url, title) {
    if (!url) return
    if (!title) {
      title = url
    }
    let avnode = {
      tag: 'a',
      attrs: {
        href: url,
        // 'data-url': url,
        target: '_blank',
        contenteditable: false
      },
      child: [
        title,
        {
          tag: 'i',
          attrs: {
            class: '__remove'
          }
        }
      ]
    }
    // 创建$a元素
    const $a = dom.createVdom(avnode)
    this.$cursorElm = dom.insertToRangeElm($a, this.$cursorElm, 'child-node-is-a')
    // 重置光标位置
    this.cursor.setRange(this.$cursorElm, 0)
    this.checkCursorPosition()
  }

  /**
   * 设置$content底部距离
   * @param pos
   * @param offset 偏移量，使文章内容更容易查看
   */
  resetContentPostion (pos, offset = 13) {
    this.$content.style.marginBottom = pos + offset + 'px'
  }

  /**
   * 标签样式处理
   * @param el 标签按钮对象
   * @private
   */
  _tagnameHandle (el) {
    const TAG_ITEMS = {
      'big': 'h2',
      'small': 'h4',
      'normal': 'p',
      'quote': 'blockquote',
      'unordered': 'ul'
    }

    const className = el.className

    if (el.querySelector('.checked') === null) {
      this._appendCheckedIcon(el)
      // 去掉兄弟节点上的选中符号
      let siblings = dom.siblings(el) || []
      siblings.forEach((item) => {
        this._removeCheckedIcon(item)
      })
      // 给当前焦点元素节点，添加样式
      let tag = 'p'
      let tagMatch = className.match(/\b(\w+?)-hook\b/)
      if (tagMatch && tagMatch[1]) {
        try {
          tag = TAG_ITEMS[tagMatch[1]]
        } catch (e) {}
      }
      // this.log(this.cursor)
      let newElm = dom.changeTagName(this.$cursorElm, tag)
      dom.insertAfter(this.$cursorElm, newElm)
      this.$content.removeChild(this.$cursorElm)
      this.$cursorElm = newElm
      this.cursor.setPosition(this.$cursorElm)
    }
  }

  /**
   * 插入空行
   * @private
   */
  _insertEmptyParagraph () {
    this.$cursorElm = dom.insertParagraph(this.$content)
    this.cursor.setPosition(p, this.$cursorElm)
  }

  /**
   * 滚动至顶部
   */
  // scrollToBottom ($el = document) {
  //   let timer = setTimeout(function () {
  //     // error($el.scrollTop, $el.scrollHeight)
  //     $el.scrollTop = $el.scrollHeight
  //     clearTimeout(timer)
  //     timer = null
  //   }, 100)
  // }

  /**
   * 获取正文中的base64图片
   * @returns {Array}
   */
  getBase64Images () {
    const arr = []
    const $imgs = dom.queryAll('img', this.$content)
    let $img, base64
    for (let i = 0; i < $imgs.length; i++) {
      $img = $imgs[i]
      base64 = $img.src
      if (/^data:.+?;base64,/.test(base64)) {
        arr.push({
          id: $img.id,
          base64: base64,
          blob: imgHandler.toBlobData(base64)
        })
      }
    }
    return arr
  }

  /**
   * 设置指定id图片src
   * @param id
   * @param src
   * @returns {boolean}
   */
  setImageSrc (id, src) {
    let $img = dom.query('#' + id, this.$content)
    if ($img) {
      $img.src = src
      $img.removeAttribute('id')
      return true
    }
    return false
  }

  /**
   * 初始化可视区间位置参数
   */
  initVisiblePostion () {
    const NAVBAR_HEIGHT = util.int(this.options.offsetTop)
    let state = this.state
    let toolbarHeight = 0
    const winW = window.innerWidth
    const winH = window.innerHeight
    let bottomModalShow = (this.emojiModal && this.emojiModal.visible) || (this.textstyleModal && this.textstyleModal.visible)
    let bottomModalHeight = bottomModalShow ? this.bottomModalHeight : 0
    if (state.toolbarShow) {
      toolbarHeight = this.$toolbar.offsetHeight
    }

    this.visiblePosition = {
      window: [winW, winH],
      startX: 0,
      endX: winW,
      startY: NAVBAR_HEIGHT,
      endY: winH - toolbarHeight - bottomModalHeight - NAVBAR_HEIGHT
    }
    this.debug.add(this.visiblePosition)
  }

  /**
   * 检查光标元素位置
   */
  checkCursorPosition () {
    this.initVisiblePostion()
    const vpos = this.visiblePosition
    const $el = this.$cursorElm
    if (!$el) return
    let pos = $el.getBoundingClientRect()
    const $body = dom.query('html')
    let scrollHeight = $body.scrollHeight
    let top = $body.scrollTop + pos.bottom - vpos.endY
    // console.error(top)
    // console.log(scrollHeight, document.body.scrollTop)
    if (pos.bottom > vpos.endY) {
      // document.scrollTo()
      $body.scrollTop = top
    }
  }

  /**
   * 设置内容
   * @param data
   */
  setContent (data) {
    this.$content.innerHTML = data
    // 检查内容是否为空
    if (!checkContentInnerNull(this.$content)) {
      removeContentClass(this.$content)
    }
  }

  /**
   * 获取正文内容
   * @param isText 是否为纯文本，默认为false，html代码
   */
  getContent (isText = false) {
    return this.$content[isText ? 'innerText' : 'innerHTML']
  }
}

for (let key in dom) {
  ZxEditor.prototype[key] = dom[key]
}

for (let key in util) {
  ZxEditor.prototype[key] = util[key]
}

ZxEditor.version = '__VERSION__'

export { ZxEditor }