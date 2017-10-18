
import React from 'react'
import find from 'lodash/find'
import isPlainObject from 'is-plain-object'
import logger from 'slate-dev-logger'
import typeOf from 'type-of'
import { Record } from 'immutable'

import MODEL_TYPES from '../constants/model-types'
import Range from '../models/range'
import isReactComponent from '../utils/is-react-component'

/**
 * Default properties.
 *
 * @type {Object}
 */

const DEFAULTS = {
  rules: [],
}

/**
 * Schema.
 *
 * @type {Schema}
 */

class Schema extends Record(DEFAULTS) {

  /**
   * Create a new `Schema` with `attrs`.
   *
   * @param {Object|Schema} attrs
   * @return {Schema}
   */

  static create(attrs = {}) {
    if (Schema.isSchema(attrs)) {
      return attrs
    }

    if (isPlainObject(attrs)) {
      return Schema.fromJSON(attrs)
    }

    throw new Error(`\`Schema.create\` only accepts objects or schemas, but you passed it: ${attrs}`)
  }

  /**
   * Check if a `value` is a `Schema`.
   *
   * @param {Any} value
   * @return {Boolean}
   */

  static isSchema(value) {
    return !!(value && value[MODEL_TYPES.SCHEMA])
  }

  /**
   * Create a `Schema` from a JSON `object`.
   *
   * @param {Object} object
   * @return {Schema}
   */

  static fromJSON(object) {
    object = normalizeProperties(object)
    const schema = new Schema(object)
    return schema
  }

  /**
   * Alias `fromJS`.
   */

  static fromJS = Schema.fromJSON

  /**
   * Get the kind.
   *
   * @return {String}
   */

  get kind() {
    return 'schema'
  }

  /**
   * Return true if one rule can normalize the document
   *
   * @return {Boolean}
   */

  get hasValidators() {
    const { rules } = this
    return rules.some(rule => rule.validate)
  }

  /**
   * Return true if one rule can decorate text nodes
   *
   * @return {Boolean}
   */

  get hasDecorators() {
    const { rules } = this
    return rules.some(rule => rule.decorate)
  }

  /**
   * Return the component for an `object`.
   *
   * This method is private, because it should always be called on one of the
   * often-changing immutable objects instead, since it will be memoized for
   * much better performance.
   *
   * @param {Mixed} object
   * @return {Component|Null}
   */

  __getComponent(object) {
    const match = find(this.rules, rule => rule.render && rule.match(object))
    if (!match) return null
    return match.render
  }

  /**
   * Return the placeholder for an `object`.
   *
   * This method is private, because it should always be called on one of the
   * often-changing immutable objects instead, since it will be memoized for
   * much better performance.
   *
   * @param {Mixed} object
   * @return {Component|Null}
   */

  __getPlaceholder(object) {
    const match = find(this.rules, rule => rule.placeholder && rule.match(object))
    if (!match) return null
    return match.placeholder
  }

  /**
   * Return the decorations for an `object`.
   *
   * This method is private, because it should always be called on one of the
   * often-changing immutable objects instead, since it will be memoized for
   * much better performance.
   *
   * @param {Mixed} object
   * @return {List<Range>}
   */

  __getDecorations(object) {
    const array = []

    this.rules.forEach((rule) => {
      if (!rule.decorate) return
      if (!rule.match(object)) return

      const decorations = rule.decorate(object)
      if (!decorations.length) return

      decorations.forEach((dec) => {
        array.push(dec)
      })
    })

    const list = Range.createList(array)
    return list
  }

  /**
   * Validate an `object` against the schema, returning the failing rule and
   * value if the object is invalid, or void if it's valid.
   *
   * This method is private, because it should always be called on one of the
   * often-changing immutable objects instead, since it will be memoized for
   * much better performance.
   *
   * @param {Mixed} object
   * @return {Object|Void}
   */

  __validate(object) {
    let value

    const match = find(this.rules, (rule) => {
      if (!rule.validate) return
      if (!rule.match(object)) return

      value = rule.validate(object)
      return value
    })

    if (!value) return

    return {
      rule: match,
      value,
    }
  }

}

/**
 * Normalize the `properties` of a schema.
 *
 * @param {Object} properties
 * @return {Object}
 */

function normalizeProperties(properties) {
  let { rules = [], nodes, marks } = properties

  if (nodes) {
    const array = normalizeNodes(nodes)
    rules = rules.concat(array)
  }

  if (marks) {
    const array = normalizeMarks(marks)
    rules = rules.concat(array)
  }

  if (properties.transform) {
    logger.deprecate('0.22.0', 'The `schema.transform` property has been deprecated in favor of `schema.change`.')
    properties.change = properties.transform
    delete properties.transform
  }

  return { rules }
}

/**
 * Normalize a `nodes` shorthand argument.
 *
 * @param {Object} nodes
 * @return {Array}
 */

function normalizeNodes(nodes) {
  const rules = []

  for (const key in nodes) {
    let rule = nodes[key]

    if (typeOf(rule) == 'function' || isReactComponent(rule)) {
      rule = { render: rule }
    }

    rule.match = (object) => {
      return (
        (object.kind == 'block' || object.kind == 'inline') &&
        object.type == key
      )
    }

    rules.push(rule)
  }

  return rules
}

/**
 * Normalize a `marks` shorthand argument.
 *
 * @param {Object} marks
 * @return {Array}
 */

function normalizeMarks(marks) {
  const rules = []

  for (const key in marks) {
    let rule = marks[key]

    if (!rule.render && !rule.decorator && !rule.validate) {
      rule = { render: rule }
    }

    rule.render = normalizeMarkComponent(rule.render)
    rule.match = object => object.kind == 'mark' && object.type == key
    rules.push(rule)
  }

  return rules
}

/**
 * Normalize a mark `render` property.
 *
 * @param {Component|Function|Object|String} render
 * @return {Component}
 */

function normalizeMarkComponent(render) {
  if (isReactComponent(render)) return render

  switch (typeOf(render)) {
    case 'function':
      return render
    case 'object':
      return props => <span style={render}>{props.children}</span>
    case 'string':
      return props => <span className={render}>{props.children}</span>
  }
}

/**
 * Attach a pseudo-symbol for type checking.
 */

Schema.prototype[MODEL_TYPES.SCHEMA] = true

/**
 * Export.
 *
 * @type {Schema}
 */

export default Schema
