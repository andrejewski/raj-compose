const tag = require('tagmeme')
const invariant = require('invariant')

function mapEffect (effect, callback) {
  invariant(typeof callback === 'function', 'callback must be a function')

  if (!effect) {
    return effect
  }

  invariant(typeof effect === 'function', 'Effects must be functions or falsey')

  return function _mapEffect (dispatch) {
    function intercept (message) {
      dispatch(callback(message))
    }

    return effect(intercept)
  }
}

function batchEffects (effects) {
  for (let i = 0; i < effects.length; i++) {
    const effect = effects[i]
    invariant(!effect || typeof effect === 'function', 'Effects must be functions or falsey')
  }

  return function _batchEffects (dispatch) {
    return effects.map(effect => {
      if (effect) {
        return effect(dispatch)
      }
    })
  }
}

function ensureProgram (program) {
  invariant(program, 'program must be truthy')
  invariant(Array.isArray(program.init), 'program.init must be an array')
  invariant(typeof program.update === 'function', 'program.update must be a function')
  invariant(typeof program.view === 'function', 'program.view must be a function')
}

function mapProgram (program, callback) {
  ensureProgram(program)
  invariant(typeof callback === 'function', 'callback must be a function')

  const [state, effect] = program.init
  const init = [state, mapEffect(effect, callback)]

  function update (msg, state) {
    const [nextState, nextEffect] = program.update(msg, state)
    const effect = mapEffect(nextEffect, callback)
    return [nextState, effect]
  }

  function view (state, dispatch) {
    return program.view(state, msg => dispatch(callback(msg)))
  }

  return {init, update, view}
}

function batchPrograms (programs, containerView) {
  for (let i = 0; i < programs.length; i++) {
    ensureProgram(programs[i])
  }
  invariant(typeof containerView === 'function', 'containerView must be a function')

  const taggers = programs.map(
    ({displayName}) => displayName ? tag(displayName) : tag()
  )
  const Msg = tag.union(taggers)
  const embeds = programs.map(
    (program, index) => mapProgram(program, taggers[index])
  )

  const [states, initialEffects] = embeds.reduce(
    ([states, effects], {init: [state, effect]}) => [
      [...states, state],
      [...effects, effect]
    ],
    [[], []]
  )
  const init = [states, batchEffects(initialEffects)]

  function update (msg, state) {
    return Msg.match(msg, embeds.reduce((cases, embed, index) => {
      const tagger = taggers[index]
      const fn = programMsg => {
        const programState = state[index]
        const [nextProgramState, effect] = embed.update(programMsg, programState)
        state[index] = nextProgramState
        return [state, effect]
      }
      return [...cases, tagger, fn]
    }, []))
  }

  function view (state, dispatch) {
    const programViews = embeds.map(
      (embed, index) => () => embed.view(state[index], dispatch)
    )

    return containerView(programViews)
  }

  return {init, update, view}
}

module.exports = {
  mapEffect,
  batchEffects,

  mapProgram,
  batchPrograms
}
