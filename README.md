# Raj Compose
> Program composition for [Raj](https://github.com/andrejewski/raj)

```sh
npm install raj-compose
```

[![npm](https://img.shields.io/npm/v/raj-compose.svg)](https://www.npmjs.com/package/raj-compose)
[![Build Status](https://travis-ci.org/andrejewski/raj-compose.svg?branch=master)](https://travis-ci.org/andrejewski/raj-compose)
[![Greenkeeper badge](https://badges.greenkeeper.io/andrejewski/raj-compose.svg)](https://greenkeeper.io/)

The `raj-compose` package contains utilities to reduce the boilerplate of
building up large applications from small programs.

## Documentation
The package contains the following utilities:

- [`mapEffect(effect, callback)`](#mapeffect)
- [`batchEffects(effects)`](#batcheffects)
- [`mapProgram(program, callback)`](#mapprogram)
- [`batchPrograms(programs, containerView)`](#batchprograms)
- [`assembleProgram({ data, view, logic, deps, options })`](#assembleprogram)

### `mapEffect`

> `mapEffect(effect: function?, callback(any): any): function?`

The `mapEffect` function "lifts" a given `effect` so that `callback` transforms
  each message produced by that effect before dispatch.

The `mapEffect` function accepts a `effect` function or a falsy value and a
  `callback` function.
If the `effect` is truthy but not a function, an error will throw.
If the `callback` is not a function, an error will throw.
The `mapEffect` returns either the falsy `effect` value or a new effect function.

#### Example
We want to distinguish the messages dispatched by an effect.
We use `mapEffect` to wrap each message in an "important" wrapper.

```js
import assert from 'assert'
import { mapEffect } from 'raj-compose'

const effect = dispatch => {
  dispatch('Hello')
  dispatch('World')
}

const importantEffect = mapEffect(effect, message => ({
  type: 'important',
  value: message
}))

const messages = []
importantEffect(message => {
  messages.push(message)
})

assert.deepEqual(messages, [
  { type: 'important', value: 'Hello' },
  { type: 'important', value: 'World' }
])
```

### `batchEffects`

> `batchEffects(effects: Array<function?>): function`

The `batchEffects` function takes an array of `effects` and returns a new
  function which will call each effect.
If an effect is truthy but not a function, an error will throw.

#### Example
We have two effects we want to run together.
We use `batchEffects` to combine them into a single effect.

```js
import assert from 'assert'
import { batchEffects } from 'raj-compose'

const one = dispatch => dispatch('Hello')
const two = dispatch => dispatch('World')
const all = batchEffects([one, two])

const messages = []
all(message => {
  messages.push(message)
})

assert.deepEqual(messages, [
  'Hello',
  'World'
])
```

### `mapProgram`

> `mapProgram(program: RajProgram, callback): RajProgram`

Like `mapEffect`, `mapProgram` "lifts" all messages from `program` with the  `callback` function and returns a new program.
If `program` is not shaped like a Raj program, an error will throw.
If `callback` is not a function, an error will throw.

The `mapProgram` function:
- transforms the `program.init` optional effect messages with `callback`
- transforms each `program.update()` optional effect messages with `callback`
- transforms each `program.view()` dispatched message with `callback`

This function encapsulates all program messages for its parent program to pass down to the child.

The new program's `update()` parameters are the same as the original's.
The `view()` `state` is the child program's state and `dispatch` is the parent's dispatch function.

### `batchPrograms`

> `batchPrograms(programs: Array<RajProgram>, containerView: function): RajProgram`

The `batchPrograms` function takes an array of `programs` and a `containerView` function and creates a new program which manages those child programs.
If any item in the `programs` array is not a program, an error will throw.
If `containerView` is not a function, an error will throw.

The `containerView` receives an array of functions which return views for each respective program.

#### Example
We have a main view and a sidebar view that we would like to display at the same time. We are using React as our view layer so we are using JSX to describe our HTML. We use the `batchPrograms` to unite the two programs in the same app view.

```js
import React from 'react'
import { batchPrograms } from 'raj-compose'
import mainProgram from './main'
import sidebarProgram from './sidebar'

export default batchPrograms(
  [mainProgram, sidebarProgram],
  ([mainView, sideView]) => (
    <div id='app'>
      <div id='side'>{sideView()}</div>
      <div id='main'>{mainView()}</div>
    </div>
  )
)
```

### `assembleProgram`

> `assembleProgram({data, view, logic, dataOptions, viewOptions, logicOptions}): RajProgram`

The `assembleProgram` function takes three functions:

- `data(dataOptions)`
- `view(model, dispatch, viewOptions)`
- `logic(data(dataOptions), logicOptions)`

The `dataOptions`, `viewOptions`, `logicOptions`, and return value of `data` can be anything that makes sense to the program.
This will return a program where `logic()` would return an object containing `{init, update, done, ...}` properties that merge in with `view`.

This function is good for separating the concerns common to most programs: data-fetching, views, and business logic.
The assemble pattern is useful as each function can be tested in isolation.
Structuring programs in this manner is recommended when data-fetching is involved.

```js
import { assembleProgram } from 'raj-compose'

export const data = ({ httpClient }) => ({
  getPosts (dispatch) {
    httpClient.get('/posts')
      .then(data => dispatch({ data }))
      .catch(error => dispatch({ error }))
  }
})

export function view (model, dispatch, options) {
  // show a list of posts
}

export function logic (data, options) {
  const init = [
    {
      posts: [],
      loadError: null
    },
    data.getPosts
  ]

  function update (msg, model) {
    if (msg.error) {
      return [{ ...model, loadError: model.error }]
    } else {
      return [{ ...model, posts: msg.data.posts }]
    }
  }

  return { init, update }
}

export function makeProgram (httpClient) {
  return assembleProgram({
    data,
    view,
    logic,
    dataOptions: { httpClient }
  })
}
```