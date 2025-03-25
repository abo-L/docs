import dotenv from 'dotenv'
import { test, expect } from '@playwright/test'
import { turnOffExperimentsBeforeEach } from '../helpers/turn-off-experiments'

// This exists for the benefit of local testing.
// In GitHub Actions, we rely on setting the environment variable directly
// but for convenience, for local development, engineers might have a
// .env file that can set environment variable. E.g. ELASTICSEARCH_URL.
// The `src/frame/start-server.ts` script uses dotenv too, but since Playwright
// tests only interface with the server via HTTP, we too need to find
// this out.
dotenv.config()

turnOffExperimentsBeforeEach(test)

const SEARCH_TESTS = !!process.env.ELASTICSEARCH_URL

test('view home page', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/GitHub Docs/)
})

test('logo link keeps current version', async ({ page }) => {
  await page.goto('/enterprise-cloud@latest')
  // Basically clicking into any page that isn't the home page for this version.
  await page.getByTestId('product').getByRole('link', { name: 'Get started' }).click()
  await expect(page).toHaveURL(/\/en\/enterprise-cloud@latest\/get-started/)
  await page.getByRole('link', { name: 'GitHub Docs' }).click()
  await expect(page).toHaveURL(/\/en\/enterprise-cloud@latest/)
})

test('view the for-playwright article', async ({ page }) => {
  await page.goto('/get-started/foo/for-playwright')
  await expect(page).toHaveTitle(/For Playwright - GitHub Docs/)

  // This is the right-hand sidebar mini-toc link
  await page
    .getByTestId('minitoc')
    .getByRole('link', { name: 'Second heading', exact: true })
    .click()
  await expect(page).toHaveURL(/for-playwright#second-heading/)
})

test('use sidebar to go to Hello World page', async ({ page }) => {
  await page.goto('/get-started')

  await expect(page).toHaveTitle(/Getting started with HubGit/)

  await page.getByTestId('product-sidebar').getByText('Start your journey').click()
  await page.getByTestId('product-sidebar').getByText('Hello World').click()
  await expect(page).toHaveURL(/\/en\/get-started\/start-your-journey\/hello-world/)
  await expect(page).toHaveTitle(/Hello World - GitHub Docs/)
})

test('do a search from home page and click on "Foo" page', async ({ page }) => {
  test.skip(!SEARCH_TESTS, 'No local Elasticsearch, no tests involving search')

  await page.goto('/')
  await page.getByTestId('site-search-input').click()
  await page.getByTestId('site-search-input').fill('serve playwright')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/search\?query=serve\+playwright/)
  await expect(page).toHaveTitle(/\d Search results for "serve playwright"/)

  await page.getByRole('link', { name: 'For Playwright' }).click()

  await expect(page).toHaveURL(/\/get-started\/foo\/for-playwright$/)
  await expect(page).toHaveTitle(/For Playwright/)
})

test('open new search, and perform a general search', async ({ page }) => {
  test.skip(!SEARCH_TESTS, 'No local Elasticsearch, no tests involving search')

  await page.goto('/')

  // Enable the AI search experiment by overriding the control group
  await page.evaluate(() => {
    // @ts-expect-error overrideControlGroup is a custom function added to the window object
    window.overrideControlGroup('ai_search_experiment', 'treatment')
  })

  await page.getByTestId('search').click()

  await page.getByTestId('overlay-search-input').fill('serve playwright')
  // Wait for the results to load
  // NOTE: In the UI we wait for results to load before allowing "enter", because we don't want
  // to allow an unnecessary request when there are no search results. Easier to wait 1 second
  await page.waitForTimeout(1000)
  // Press enter to perform  general search
  await page.keyboard.press('Enter')

  await expect(page).toHaveURL(
    /\/search\?search-overlay-input=serve\+playwright&query=serve\+playwright/,
  )
  await expect(page).toHaveTitle(/\d Search results for "serve playwright"/)

  // The first result should be "For Playwright"
  await page.getByRole('link', { name: 'For Playwright' }).click()

  await expect(page).toHaveURL(/\/get-started\/foo\/for-playwright$/)
  await expect(page).toHaveTitle(/For Playwright/)
})

test('open new search, and select a general search article', async ({ page }) => {
  test.skip(!SEARCH_TESTS, 'No local Elasticsearch, no tests involving search')

  await page.goto('/')

  // Enable the AI search experiment by overriding the control group
  await page.evaluate(() => {
    // @ts-expect-error overrideControlGroup is a custom function added to the window object
    window.overrideControlGroup('ai_search_experiment', 'treatment')
  })

  await page.getByTestId('search').click()

  await page.getByTestId('overlay-search-input').fill('serve playwright')
  // Let new suggestions load
  await page.waitForTimeout(1000)
  // Navigate to general search item, "For Playwright"
  await page.keyboard.press('ArrowDown')
  // Select the general search item, "For Playwright"
  await page.keyboard.press('Enter')

  // We should now be on the page for "For Playwright"
  await expect(page).toHaveURL(
    /\/get-started\/foo\/for-playwright\?search-overlay-input=serve\+playwright$/,
  )
  await expect(page).toHaveTitle(/For Playwright/)
})

test('open new search, and get auto-complete results', async ({ page }) => {
  test.skip(!SEARCH_TESTS, 'No local Elasticsearch, no tests involving search')

  await page.goto('/')

  // Enable the AI search experiment by overriding the control group
  await page.evaluate(() => {
    // @ts-expect-error overrideControlGroup is a custom function added to the window object
    window.overrideControlGroup('ai_search_experiment', 'treatment')
  })

  await page.getByTestId('search').click()

  let listGroup = page.getByTestId('ai-autocomplete-suggestions')

  await expect(listGroup).toBeVisible()
  let listItems = listGroup.locator('li')
  await expect(listItems).toHaveCount(4)

  // Top queries from queries.json fixture's 'topQueries'
  let expectedTexts = [
    'What is GitHub and how do I get started?',
    'What is GitHub Copilot and how do I get started?',
    'How do I connect to GitHub with SSH?',
    'How do I generate a personal access token?',
  ]
  for (let i = 0; i < expectedTexts.length; i++) {
    await expect(listItems.nth(i)).toHaveText(expectedTexts[i])
  }

  const searchInput = await page.getByTestId('overlay-search-input')

  await expect(searchInput).toBeVisible()
  await expect(searchInput).toBeEnabled()

  // Type the text "rest" into the search input
  await searchInput.fill('rest')
  // For for 1 second for the suggestions to load
  await page.waitForTimeout(1000)

  // Ask AI suggestions
  listGroup = page.getByTestId('ai-autocomplete-suggestions')
  listItems = listGroup.locator('li')
  await expect(listItems).toHaveCount(3)
  await expect(listGroup).toBeVisible()
  expectedTexts = [
    'rest',
    'How do I manage OAuth app access restrictions for my organization?',
    'How do I test my SSH connection to GitHub?',
  ]
  for (let i = 0; i < expectedTexts.length; i++) {
    await expect(listItems.nth(i)).toHaveText(expectedTexts[i])
  }
})

test('search from enterprise-cloud and filter by top-level Fooing', async ({ page }) => {
  test.skip(!SEARCH_TESTS, 'No local Elasticsearch, no tests involving search')

  await page.goto('/enterprise-cloud@latest')

  await page.getByTestId('site-search-input').fill('fixture')
  await page.getByTestId('site-search-input').press('Enter')
  await page.getByText('Fooing (1)').click()
  await page.getByRole('link', { name: 'Clear' }).click()

  // At the moment this test isn't great because it's not proving that
  // certain things cease to be visible, that was visible before. Room
  // for improvement!
})

test.describe('platform picker', () => {
  test('switch operating systems', async ({ page }) => {
    await page.goto('/get-started/liquid/platform-specific')

    await page.getByTestId('platform-picker').getByRole('link', { name: 'Mac' }).click()
    await expect(page).toHaveURL(/\?platform=mac/)
    await expect(page.getByRole('heading', { name: /Macintosh/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Windows 95/ })).not.toBeVisible()

    await page.getByTestId('platform-picker').getByRole('link', { name: 'Windows' }).click()
    await expect(page).toHaveURL(/\?platform=windows/)
    await expect(page.getByRole('heading', { name: /Windows 95/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Macintosh/ })).not.toBeVisible()
  })

  test('minitoc matches picker', async ({ page }) => {
    // default platform set to windows in fixture fronmatter
    await page.goto('/get-started/liquid/platform-specific')
    await expect(
      page.getByTestId('minitoc').getByRole('link', { name: 'Macintosh until 1999' }),
    ).not.toBeVisible()
    await expect(
      page.getByTestId('minitoc').getByRole('link', { name: 'Windows 95 was awesome' }),
    ).toBeVisible()
    await page.getByTestId('platform-picker').getByRole('link', { name: 'Linux' }).click()
    await expect(
      page.getByTestId('minitoc').getByRole('link', { name: 'Macintosh until 1999' }),
    ).not.toBeVisible()
    await expect(
      page.getByTestId('minitoc').getByRole('link', { name: 'The year of Linux on the desktop' }),
    ).toBeVisible()
  })

  test('remember last clicked OS', async ({ page }) => {
    await page.goto('/get-started/liquid/platform-specific')
    await page.getByTestId('platform-picker').getByRole('link', { name: 'Windows' }).click()

    // Return and now the cookie should start us off on Windows again
    await page.goto('/get-started/liquid/platform-specific')
    await expect(page.getByRole('heading', { name: /Windows 95/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Macintosh/ })).not.toBeVisible()
  })
})

test.describe('tool picker', () => {
  test('switch tools', async ({ page }) => {
    await page.goto('/get-started/liquid/tool-specific')

    await page.getByTestId('tool-picker').getByRole('link', { name: 'GitHub CLI' }).click()
    await expect(page).toHaveURL(/\?tool=cli/)
    await expect(page.getByText('this is cli content')).toBeVisible()
    await expect(page.getByText('this is webui content')).not.toBeVisible()

    await page.getByTestId('tool-picker').getByRole('link', { name: 'Web browser' }).click()
    await expect(page).toHaveURL(/\?tool=webui/)
    await expect(page.getByText('this is cli content')).not.toBeVisible()
    await expect(page.getByText('this is desktop content')).not.toBeVisible()
    await expect(page.getByText('this is webui content')).toBeVisible()
  })

  test('prefer default tool', async ({ page }) => {
    await page.goto('/get-started/liquid/tool-specific')

    // defaultTool is set in the fixture frontmatter
    await expect(page.getByText('this is desktop content')).toBeVisible()
    await expect(page.getByText('this is webui content')).not.toBeVisible()
    await expect(page.getByText('this is cli content')).not.toBeVisible()
  })

  test('remember last clicked tool', async ({ page }) => {
    await page.goto('/get-started/liquid/tool-specific')
    await page.getByTestId('tool-picker').getByRole('link', { name: 'Web browser' }).click()

    // Return and now the cookie should start us off with Web UI content again
    await page.goto('/get-started/liquid/tool-specific')
    await expect(page.getByText('this is cli content')).not.toBeVisible()
    await expect(page.getByText('this is desktop content')).not.toBeVisible()
    await expect(page.getByText('this is webui content')).toBeVisible()
  })

  test('minitoc matches picker', async ({ page }) => {
    // default tool set to desktop in fixture fronmatter
    await page.goto('/get-started/liquid/tool-specific')
    await expect(
      page.getByTestId('minitoc').getByRole('link', { name: 'Desktop section' }),
    ).toBeVisible()
    await expect(
      page.getByTestId('minitoc').getByRole('link', { name: 'Webui section' }),
    ).not.toBeVisible()
    await page.getByTestId('tool-picker').getByRole('link', { name: 'Web browser' }).click()
    await expect(
      page.getByTestId('minitoc').getByRole('link', { name: 'Desktop section' }),
    ).not.toBeVisible()
    await expect(
      page.getByTestId('minitoc').getByRole('link', { name: 'Webui section' }),
    ).toBeVisible()
  })
})

test('navigate with side bar into article inside a map-topic inside a category', async ({
  page,
}) => {
  // Our TreeView sidebar only shows "2 levels". If you click and expand
  // the category, you'll be able to see the map-topic and the article
  // within.
  await page.goto('/actions')
  await page.getByTestId('sidebar').getByText('Category').click()
  await page.getByText('Map & Topic').click()
  await page.getByText('<article>').click()
  await expect(page.getByRole('heading', { name: 'Article title' })).toBeVisible()
  await expect(page).toHaveURL(/actions\/category\/map-topic\/article/)
})

test.describe('hover cards', () => {
  test('hover over link', async ({ page }) => {
    await page.goto('/pages/quickstart')

    // hover over a link and check for intro content from hovercard
    await page
      .locator('#article-contents')
      .getByRole('link', { name: 'Start your journey' })
      .hover()
    await expect(
      page.getByText(
        'Get started using HubGit to manage Git repositories and collaborate with others.',
      ),
    ).toBeVisible()

    // now move the mouse away from hovering over the link, the hovercard should
    // no longer be visible
    await page.mouse.move(0, 0)
    await expect(
      page.getByText(
        'Get started using GitHub to manage Git repositories and collaborate with others.',
      ),
    ).not.toBeVisible()

    // external links don't have a hovercard
    await page.getByRole('link', { name: 'github.com/github/docs' }).hover()
    await expect(page.getByTestId('popover')).not.toBeVisible()

    // links in the main navigation sidebar don't have a hovercard
    await page.getByTestId('sidebar').getByRole('link', { name: 'Quickstart' }).hover()
    await expect(page.getByTestId('popover')).not.toBeVisible()

    // links in the secondary minitoc sidebar don't have a hovercard
    await page
      .getByTestId('minitoc')
      .getByRole('link', { name: 'Regular internal link', exact: true })
      .hover()
    await expect(page.getByTestId('popover')).not.toBeVisible()

    // links in the article intro have a hovercard
    await page.locator('#article-intro').getByRole('link', { name: 'article intro link' }).hover()
    await expect(page.getByText('You can use HubGit Pages to showcase')).toBeVisible()
    // this page's intro has two links; one in-page and one internal
    await page.locator('#article-intro').getByRole('link', { name: 'another link' }).hover()
    await expect(
      page.getByText('Follow this Hello World exercise to get started with HubGit.'),
    ).toBeVisible()

    // same page anchor links have a hovercard
    await page
      .locator('#article-contents')
      .getByRole('link', { name: 'introduction', exact: true })
      .hover()
    await expect(page.getByText('You can use HubGit Pages to showcase')).toBeVisible()

    // links with formatted text need to work too
    await page.locator('#article-contents').getByRole('link', { name: 'Bold is strong' }).hover()
    await expect(page.getByText('The most basic of fixture data for HubGit')).toBeVisible()
    await page.locator('#article-contents').getByRole('link', { name: 'bar' }).hover()
    await expect(page.getByText("This page doesn't really have an intro")).toBeVisible()
  })

  test('use keyboard shortcut to open hover card', async ({ page }) => {
    await page.goto('/pages/quickstart')

    // Simply putting focus on the link should not open the hovercard
    await page
      .locator('#article-contents')
      .getByRole('link', { name: 'Start your journey' })
      .focus()
    await expect(
      page.getByText(
        'Get started using GitHub to manage Git repositories and collaborate with others.',
      ),
    ).not.toBeVisible()

    // Once a link has got focus, you can use Alt+ArrowUp to open the hovercard
    await page.keyboard.press('Alt+ArrowUp')
    await expect(
      page.getByText(
        'Get started using HubGit to manage Git repositories and collaborate with others.',
      ),
    ).toBeVisible()

    // Press Escape to close it
    await page.keyboard.press('Escape')
    await expect(
      page.getByText(
        'Get started using GitHub to manage Git repositories and collaborate with others.',
      ),
    ).not.toBeVisible()
  })

  test('able to use Esc to close hovercard', async ({ page }) => {
    await page.goto('/pages/quickstart')

    // hover over a link and check for intro content from hovercard
    await page
      .locator('#article-contents')
      .getByRole('link', { name: 'Start your journey' })
      .hover()
    await expect(
      page.getByText(
        'Get started using HubGit to manage Git repositories and collaborate with others.',
      ),
    ).toBeVisible()

    // click the Esc key to close the hovercard
    await page.keyboard.press('Escape')
    await expect(
      page.getByText(
        'Get started using GitHub to manage Git repositories and collaborate with others.',
      ),
    ).not.toBeVisible()
  })
})

test.describe('test nav at different viewports', () => {
  test('xx-large viewports - 1400+', async ({ page }) => {
    page.setViewportSize({
      width: 1400,
      height: 700,
    })
    await page.goto('/get-started/foo/bar')

    // in article breadcrumbs at our custom xl viewport should remove last
    // breadcrumb so for this page we should only have 'Get Started / Foo'
    expect(await page.getByTestId('breadcrumbs-in-article').getByRole('link').all()).toHaveLength(2)
    await expect(page.getByTestId('breadcrumbs-in-article').getByText('Foo')).toBeVisible()
    await expect(page.getByTestId('breadcrumbs-in-article').getByText('Bar')).not.toBeVisible()

    // breadcrumbs show up in rest reference pages
    await page.goto('/rest/actions/artifacts')
    await expect(page.getByTestId('breadcrumbs-in-article')).toBeVisible()

    // breadcrumbs show up in one of the pages that use the AutomatedPage
    // component (e.g. graphql, audit log, etc.) -- we test the webhooks
    // reference page here
    await page.goto('/webhooks/webhook-events-and-payloads')
    await expect(page.getByTestId('breadcrumbs-in-article')).toBeVisible()
  })

  test('large -> x-large viewports - 1012+', async ({ page }) => {
    page.setViewportSize({
      width: 1013,
      height: 700,
    })
    await page.goto('/get-started/foo/bar')

    // version picker should be visible
    await page
      .getByRole('button', {
        name: 'Select GitHub product version: current version is free-pro-team@latest',
      })
      .click()
    expect((await page.getByRole('menuitemradio').all()).length).toBeGreaterThan(0)
    await expect(page.getByRole('menuitemradio', { name: 'Enterprise Cloud' })).toBeVisible()

    // language picker is visible
    await page.getByRole('button', { name: 'Select language: current language is English' }).click()
    await expect(page.getByRole('menuitemradio', { name: 'English' })).toBeVisible()

    // header sign up button is visible
    await expect(page.getByTestId('header-signup')).toBeVisible()
  })

  test('large viewports - 1012-1279', async ({ page }) => {
    page.setViewportSize({
      width: 1013,
      height: 700,
    })
    await page.goto('/get-started/foo/bar')

    // breadcrumbs show up in the header, for this page we should have
    // 3 items 'Get Started / Foo / Bar'
    // in-article breadcrumbs don't show up
    await expect(page.getByTestId('breadcrumbs-header')).toBeVisible()
    expect(await page.getByTestId('breadcrumbs-header').getByRole('link').all()).toHaveLength(3)
    await expect(page.getByTestId('breadcrumbs-in-article')).not.toBeVisible()

    // hamburger button for sidebar overlay is visible
    await expect(page.getByTestId('sidebar-hamburger')).toBeVisible()
    await page.getByTestId('sidebar-hamburger').click()
    await expect(page.getByTestId('sidebar-product-dialog')).toBeVisible()
  })

  test('medium viewports - 768-1011', async ({ page }) => {
    page.setViewportSize({
      width: 1000,
      height: 700,
    })
    await page.goto('/get-started/foo/bar')

    // version picker is visible
    await page
      .getByRole('button', {
        name: 'Select GitHub product version: current version is free-pro-team@latest',
      })
      .click()
    expect((await page.getByRole('menuitemradio').all()).length).toBeGreaterThan(0)
    await expect(page.getByRole('menuitemradio', { name: 'Enterprise Cloud' })).toBeVisible()

    // language picker is in mobile menu
    await page.getByTestId('mobile-menu').click()
    await expect(page.getByRole('menuitemradio', { name: 'English' })).toBeVisible()

    // sign up button is in mobile menu
    await expect(page.getByTestId('mobile-signup')).toBeVisible()

    // hamburger button for sidebar overlay is visible
    await expect(page.getByTestId('sidebar-hamburger')).toBeVisible()
    await page.getByTestId('sidebar-hamburger').click()
    await expect(page.getByTestId('sidebar-product-dialog')).toBeVisible()
  })

  test('small viewports - 544-767', async ({ page }) => {
    page.setViewportSize({
      width: 555,
      height: 700,
    })
    await page.goto('/get-started/foo/bar')

    // header sign-up button is not visible
    await expect(page.getByTestId('header-signup')).not.toBeVisible()

    // language picker is not visible
    await expect(page.getByTestId('language-picker')).not.toBeVisible()

    // version picker is visible
    await expect(
      page.getByRole('button', {
        name: 'Select GitHub product version: current version is free-pro-team@latest',
      }),
    ).toBeVisible()

    // language picker is in mobile menu
    await page.getByTestId('mobile-menu').click()
    await expect(page.getByRole('menuitemradio', { name: 'English' })).toBeVisible()

    // sign up button is in mobile menu
    await expect(page.getByTestId('mobile-signup')).toBeVisible()

    // hamburger button for sidebar overlay is visible
    await expect(page.getByTestId('sidebar-hamburger')).toBeVisible()
    await page.getByTestId('sidebar-hamburger').click()
    await expect(page.getByTestId('sidebar-product-dialog')).toBeVisible()
  })

  test('x-small viewports - 0-544', async ({ page }) => {
    page.setViewportSize({
      width: 345,
      height: 700,
    })
    await page.goto('/get-started/foo/bar')

    // header sign-up button is not visible
    await expect(page.getByTestId('header-signup')).not.toBeVisible()

    // language picker is not visible
    await expect(page.getByTestId('language-picker')).not.toBeVisible()

    // version picker is not visible
    await expect(
      page.getByRole('button', {
        name: 'Select GitHub product version: current version is free-pro-team@latest',
      }),
    ).not.toBeVisible()

    // version picker is in mobile menu
    await expect(page.getByTestId('version-picker')).not.toBeVisible()
    await page.getByTestId('mobile-menu').click()
    await expect(page.getByTestId('open-mobile-menu').getByTestId('version-picker')).toBeVisible()

    // language picker is in mobile menu
    await expect(page.getByTestId('open-mobile-menu').getByTestId('language-picker')).toBeVisible()

    // sign up button is in mobile menu
    await expect(page.getByTestId('mobile-signup')).toBeVisible()

    // hamburger button for sidebar overlay is visible
    await expect(page.getByTestId('sidebar-hamburger')).toBeVisible()
    await page.getByTestId('sidebar-hamburger').click()
    await expect(page.getByTestId('sidebar-product-dialog')).toBeVisible()
  })

  test('do a search when the viewport is x-small', async ({ page }) => {
    test.skip(!SEARCH_TESTS, 'No local Elasticsearch, no tests involving search')

    page.setViewportSize({
      width: 500,
      height: 700,
    })
    await page.goto('/get-started/foo/bar')
    await page.getByRole('button', { name: 'Open Search Bar' }).click()
    await page.getByTestId('site-search-input').click()
    await page.getByTestId('site-search-input').fill('serve playwright')
    await page.getByTestId('site-search-input').press('Enter')
    await expect(page).toHaveURL(/\/search\?query=serve\+playwright/)
    await expect(page).toHaveTitle(/\d Search results for "serve playwright"/)
  })

  test('do a search when the viewport is medium', async ({ page }) => {
    test.skip(!SEARCH_TESTS, 'No local Elasticsearch, no tests involving search')

    page.setViewportSize({
      width: 1000,
      height: 700,
    })
    await page.goto('/get-started/foo/bar')
    await page.getByTestId('site-search-input').click()
    await page.getByTestId('site-search-input').fill('serve playwright')
    await page.getByTestId('site-search-input').press('Enter')
    await expect(page).toHaveURL(/\/search\?query=serve\+playwright/)
    await expect(page).toHaveTitle(/\d Search results for "serve playwright"/)
  })
})

test.describe('survey', () => {
  test('happy path, thumbs up and enter comment and email', async ({ page }) => {
    let fulfilled = 0
    let hasSurveyPressedEvent = false
    let hasSurveySubmittedEvent = false

    const surveyComment = 'This is a comment'

    // Important to set this up *before* interacting with the page
    // in case of possible race conditions.
    await page.route('**/api/events', (route, request) => {
      route.fulfill({})
      expect(request.method()).toBe('POST')
      const postData = JSON.parse(request.postData() || '{}')
      // Skip the exit event
      if (postData.type === 'exit') {
        return
      }
      fulfilled++
      if (postData.type === 'survey' && postData.survey_vote === true) {
        hasSurveyPressedEvent = true
      }
      if (
        postData.type === 'survey' &&
        postData.survey_vote === true &&
        postData.survey_comment === surveyComment
      ) {
        hasSurveySubmittedEvent = true
      }
      // At the time of writing you can't get the posted payload
      // when you use `navigator.sendBeacon(url, data)`.
      // So we can't make assertions about the payload.
      // See https://github.com/microsoft/playwright/issues/12231
    })

    await page.addInitScript(() => {
      window.GHDOCSPLAYWRIGHT = 1
    })

    await page.goto('/get-started/foo/for-playwright')

    // The label is visually an SVG. Finding it by its `for` value feels easier.
    await page.locator('[for=survey-yes]').click()
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Send' })).toBeVisible()

    await page.locator('[for=survey-comment]').click()
    await page.locator('[for=survey-comment]').fill(surveyComment)
    await page.locator('[name=survey-email]').click()
    await page.locator('[name=survey-email]').fill('test@example.com')
    await page.getByRole('button', { name: 'Send' }).click()
    // Events:
    // 1. page view event when navigating to the page
    // 2. Survey thumbs up event
    // 3. Survey submit event
    expect(fulfilled).toBe(1 + 1 + 1)
    expect(hasSurveyPressedEvent).toBe(true)
    expect(hasSurveySubmittedEvent).toBe(true)
    await expect(page.getByTestId('survey-end')).toBeVisible()
  })

  test('thumbs up without filling in the form sends an API POST', async ({ page }) => {
    let fulfilled = 0
    let hasSurveyEvent = false
    // Important to set this up *before* interacting with the page
    // in case of possible race conditions.
    await page.route('**/api/events', (route, request) => {
      route.fulfill({})
      expect(request.method()).toBe('POST')
      const postData = JSON.parse(request.postData() || '{}')
      // Skip the exit event
      if (postData.type === 'exit') {
        return
      }
      if (postData.type === 'survey' && postData.survey_vote === true) {
        hasSurveyEvent = true
      }
      fulfilled++
      // At the time of writing you can't get the posted payload
      // when you use `navigator.sendBeacon(url, data)`.
      // So we can't make assertions about the payload.
      // See https://github.com/microsoft/playwright/issues/12231
    })

    await page.addInitScript(() => {
      window.GHDOCSPLAYWRIGHT = 1
    })

    await page.goto('/get-started/foo/for-playwright')

    await page.locator('[for=survey-yes]').click()
    // Events:
    // 1. page view event when navigating to the page
    // 2. the thumbs up click
    expect(fulfilled).toBe(1 + 1)
    expect(hasSurveyEvent).toBe(true)

    await expect(page.getByRole('button', { name: 'Send' })).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()
  })

  test('vote on one page, then go to another and it should reset', async ({ page }) => {
    // Important to set this up *before* interacting with the page
    // in case of possible race conditions.
    await page.route('**/api/events', (route) => {
      route.fulfill({})
    })

    await page.goto('/get-started/foo/for-playwright')

    await expect(page.locator('[for=survey-comment]')).not.toBeVisible()
    await page.locator('[for=survey-yes]').click()
    await expect(page.getByRole('button', { name: 'Send' })).toBeVisible()
    await expect(page.locator('[for=survey-comment]')).toBeVisible()

    await page.getByTestId('product-sidebar').getByLabel('Bar', { exact: true }).click()
    await expect(page.getByRole('button', { name: 'Send' })).not.toBeVisible()
    await expect(page.locator('[for=survey-comment]')).not.toBeVisible()
  })
})

test.describe('rest API reference pages', () => {
  test('REST actions', async ({ page }) => {
    await page.goto('/rest')
    // Before using the sidebar, make sure the page has redirected to a
    // URL that has that `?apiVersion=` query parameter.
    await expect(page).toHaveURL(/\/en\/rest\?apiVersion=/)
    await page.getByTestId('sidebar').getByText('Actions').click()
    await page.getByTestId('sidebar').getByLabel('Artifacts').click()
    await page.getByLabel('About artifacts in HubGit Actions').click()
    await expect(page).toHaveURL(/\/en\/rest\/actions\/artifacts\?apiVersion=/)
    await expect(page).toHaveTitle(/GitHub Actions Artifacts - GitHub Docs/)
  })
})

test.describe('translations', () => {
  test('view Japanese home page', async ({ page }) => {
    await page.goto('/ja')
    await expect(page.getByRole('heading', { name: '日本 GitHub Docs' })).toBeVisible()
  })

  test('switch to Japanese from English using widget on home page', async ({ page }) => {
    await page.goto('/en')
    await page.getByRole('button', { name: 'Select language: current language is English' }).click()
    await page.getByRole('menuitemradio', { name: '日本語' }).click()
    await expect(page).toHaveURL('/ja')
    await expect(page.getByRole('heading', { name: '日本 GitHub Docs' })).toBeVisible()

    // Having done this once, should now use a cookie to redirect back to Japanese
    await page.goto('/')
    await expect(page).toHaveURL('/ja')
  })

  test('switch to Japanese from English using widget on article', async ({ page }) => {
    await page.goto('/get-started/start-your-journey/hello-world')
    await expect(page).toHaveURL('/en/get-started/start-your-journey/hello-world')
    await page.getByRole('button', { name: 'Select language: current language is English' }).click()
    await page.getByRole('menuitemradio', { name: '日本語' }).click()
    await expect(page).toHaveURL('/ja/get-started/start-your-journey/hello-world')
    await expect(page.getByRole('heading', { name: 'こんにちは World' })).toBeVisible()

    // Having done this once, should now use a cookie to redirect
    // back to Japanese.
    // Playwright will cache this redirect, so we need to add something
    // to "cache bust" the URL
    const cb = `?cb=${Math.random()}`
    await page.goto('/get-started/start-your-journey/hello-world' + cb)
    await expect(page).toHaveURL('/ja/get-started/start-your-journey/hello-world' + cb)

    // If you go, with the Japanese cookie, to the English page directly,
    // it will offer a link to the Japanese URL in a banner.
    await page.goto('/en/get-started/start-your-journey/hello-world')
    await expect(page).toHaveURL('/ja/get-started/start-your-journey/hello-world')
  })
})

test.describe('view pages with custom domain cookie', () => {
  test('view article page', async ({ page }) => {
    await page.goto(
      '/enterprise-server@latest/get-started/markdown/replace-domain?ghdomain=example.ghe.com',
    )

    const content = page.locator('pre')
    await expect(content.nth(0)).toHaveText(/curl https:\/\/example.ghe.com\/api\/v1/)
    await expect(content.nth(1)).toHaveText(/curl https:\/\/HOSTNAME\/api\/v2/)
    await expect(content.nth(2)).toHaveText('await fetch("https://example.ghe.com/api/v1")')
    await expect(content.nth(3)).toHaveText('await fetch("https://HOSTNAME/api/v2")')

    // Now switch to enterprise-cloud, where replacedomain should not be used
    await page.getByLabel('Select GitHub product version').click()
    await page.getByLabel('Enterprise Cloud', { exact: true }).click()

    await expect(content.nth(0)).toHaveText(/curl https:\/\/HOSTNAME\/api\/v1/)
    await expect(content.nth(1)).toHaveText(/curl https:\/\/HOSTNAME\/api\/v2/)
    await expect(content.nth(2)).toHaveText('await fetch("https://HOSTNAME/api/v1")')
    await expect(content.nth(3)).toHaveText('await fetch("https://HOSTNAME/api/v2")')

    // Again switch back to enterprise server again
    await page.getByLabel('Select GitHub product version').click()
    await page.getByLabel('Enterprise Server 3.').first().click()

    await expect(content.nth(0)).toHaveText(/curl https:\/\/example.ghe.com\/api\/v1/)
    await expect(content.nth(1)).toHaveText(/curl https:\/\/HOSTNAME\/api\/v2/)
    await expect(content.nth(2)).toHaveText('await fetch("https://example.ghe.com/api/v1")')
    await expect(content.nth(3)).toHaveText('await fetch("https://HOSTNAME/api/v2")')
  })
})
