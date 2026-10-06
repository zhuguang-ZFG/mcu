import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { parse } from 'yaml'

test('deployment depends on the complete reusable gate for this commit', () => {
  const deploy = parse(fs.readFileSync('.github/workflows/deploy.yml', 'utf8'))
  const quality = parse(fs.readFileSync('.github/workflows/quality.yml', 'utf8'))
  assert.equal(deploy.jobs.quality.uses, './.github/workflows/quality.yml')
  assert.equal(deploy.jobs.deploy.needs, 'quality')
  assert.match(deploy.jobs.deploy.if, /needs\.quality\.result == 'success'/)
  assert.match(deploy.jobs.deploy.if, /refs\/heads\/main/)
  assert.ok('workflow_call' in quality.on)
  assert.ok('pull_request' in quality.on)
  assert.deepEqual(Object.keys(quality.jobs).sort(), ['arm-host', 'checks', 'esp32'])
  for (const job of Object.values(quality.jobs)) {
    assert.notEqual(job['continue-on-error'], true)
    for (const step of job.steps || []) assert.notEqual(step['continue-on-error'], true)
  }
  assert.equal(quality.permissions.contents, 'read')
  assert.equal(quality.permissions.pages, undefined)
  assert.equal(quality.jobs.esp32.container, 'espressif/idf:v5.5.2')
})
