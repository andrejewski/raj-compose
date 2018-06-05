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
  invariant(!program.done || typeof program.done === 'function', 'program.done must be a function if included')
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

  return {init, update, view, done: program.done}
}

function batchPrograms (programs, containerView) {
  invariant(Array.isArray(programs), 'programs must be an array')
  invariant(typeof containerView === 'function', 'containerView must be a function')

  const embeds = []
  const states = []
  const effects = []
  const programCount = programs.length
  for (let i = 0; i < programCount; i++) {
    const program = programs[i]
    ensureProgram(program)

    const tagger = data => ({ index: i, data })
    embeds.push(mapProgram(program, tagger))
    states.push(program.init[0])
    effects.push(program.init[1])
  }

  const init = [states, batchEffects(effects)]

  function update (msg, state) {
    const { index, data } = msg
    const [newProgramState, effect] = embeds[index].update(data, state[index])
    const newState = state.slice(0)
    newState[index] = newProgramState
    return [newState, effect]
  }

  function view (state, dispatch) {
    const programViews = embeds.map(
      (embed, index) => () => embed.view(state[index], dispatch)
    )

    return containerView(programViews)
  }

  function done (state) {
    for (let i = 0; i < programCount; i++) {
      const done = embeds[i].done
      if (done) {
        done(state[i])
      }
    }
  }

  return {init, update, view, done}
}

function assembleProgram ({
  data,
  dataOptions,
  logic,
  logicOptions,
  view,
  viewOptions
}) {
  return Object.assign(
    {
      view (model, dispatch) {
        return view(model, dispatch, viewOptions)
      }
    },
    logic(data(dataOptions), logicOptions)
  )
}

exports.mapEffect = mapEffect
exports.batchEffects = batchEffects
exports.mapProgram = mapProgram
exports.batchPrograms = batchPrograms
exports.assembleProgram = assembleProgram
