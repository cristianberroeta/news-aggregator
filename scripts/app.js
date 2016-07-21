/**
 *
 * Copyright 2015 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
APP.Main = (function() {

  var LAZY_LOAD_THRESHOLD = 300;
  var LAZY_LOAD_THRESHOLD_N_OF_STORIES = 30;
  var $ = document.querySelector.bind(document);

  var stories = null;
  var storiesRequested = 0; // changed the name from storyStart
  var swappedStories = false;
  var lowerLimitToAnimateHeader = 0;
  var waitingStoryBatch = false;
  var count = 100;
  var main = $('main');
  var inDetails = false;
  var storyLoadCount = 0;
  var localeData = {
    data: {
      intl: {
        locales: 'en-US'
      }
    }
  };

  var tmplStory = $('#tmpl-story').textContent;
  var tmplStoryDetails = $('#tmpl-story-details').textContent;
  var tmplStoryDetailsComment = $('#tmpl-story-details-comment').textContent;

  if (typeof HandlebarsIntl !== 'undefined') {
    HandlebarsIntl.registerWith(Handlebars);
  } else {

    // Remove references to formatRelative, because Intl isn't supported.
    var intlRelative = /, {{ formatRelative time }}/;
    tmplStory = tmplStory.replace(intlRelative, '');
    tmplStoryDetails = tmplStoryDetails.replace(intlRelative, '');
    tmplStoryDetailsComment = tmplStoryDetailsComment.replace(intlRelative, '');
  }

  var storyTemplate =
      Handlebars.compile(tmplStory);
  var storyDetailsTemplate =
      Handlebars.compile(tmplStoryDetails);
  var storyDetailsCommentTemplate =
      Handlebars.compile(tmplStoryDetailsComment);

  var storyElements = [];
  var storyData = [];
  var storyElementPoolCreated = false;

  class StoryData {
    constructor(order, key, html, details) {
      this.order = order;
      this.key = key;
      this.innerHTML = html;
      this.details = details;
    }
    static getStoryByOrder(order) {
      for (var i = 0; i < storyData.length; i++) {
        if (storyData[i].order === order) {
          return storyData[i];
        }
      }
      return undefined;
    }
    getStoryElementAssigned() {
      return StoryElement.getStoryByOrder(this.order);
    }
  };

  var exceedViewportHeightBy = 0.5;
  class StoryElement {
    constructor(story, order) {
      this.story = story;
      this.order = order;
    };

    static setMinPoolSize(minPoolSize) {
      StoryElement.minPoolSize = minPoolSize;
    }
    static getMinPoolSize() {
      return StoryElement.minPoolSize || 10;
    }
    static getLowerOrderStoryElement() {
      var lowerIndex = 0;
      for (var i = 1; i < storyElements.length; i++) {
        if (parseInt(storyElements[i].story.style.order, 10) <
          parseInt(storyElements[lowerIndex].story.style.order, 10)) {
            lowerIndex = i;
        }
      }
      return storyElements[lowerIndex];
    }
    static getUpperOrderStoryElement() {
      var upperIndex = 0;
      for (var i = 1; i < storyElements.length; i++) {
        if (parseInt(storyElements[i].story.style.order, 10) >
          parseInt(storyElements[upperIndex].story.style.order, 10)) {
            upperIndex = i;
        }
      }
      return storyElements[upperIndex];
    }
    static getStoryByOrder(order) {
      for (var i = 0; i < storyElements.length; i++) {
        if (parseInt(storyElements[i].story.style.order, 10) === order) {
          return storyElements[i];
        }
      }
      return undefined;
    }
    static swapToBottom(storyElement) {
      var newOrder = parseInt(storyElement.story.style.order, 10) +
        storyElements.length;
      if (newOrder < storyData.length) {
        $('main').scrollTop -= storyElement.story.offsetHeight;
        storyElement.story.style.order =
          parseInt(storyElement.story.style.order, 10) + storyElements.length;
      }
    }
    static swapToTop(storyElement) {
      var newOrder = parseInt(storyElement.story.style.order, 10) -
        storyElements.length;
      if (newOrder >= 0) {
        $('main').scrollTop += storyElement.story.offsetHeight;
        storyElement.story.style.order =
          parseInt(storyElement.story.style.order, 10) - storyElements.length;
      }
    }

    setScale(scale) {
      this.scale = scale;
    }
    getScale() {
      return this.scale;
    }
    setSaturation(saturation) {
      this.saturation = saturation;
    }
    getSaturation() {
      return this.saturation;
    }
    setOpacity(opacity) {
      this.opacity = opacity;
    }
    getOpacity() {
      return this.opacity;
    }
  };

  function createStoryDetailsSection() {
    var storyDetails = document.createElement('section');
    storyDetails.setAttribute('id', 'sd');
    storyDetails.classList.add('story-details');
    //storyDetails.innerHTML = storyDetailsHtml;

    document.body.appendChild(storyDetails);
  }

  window.onload = function() {
    createStoryDetailsSection();
  };

  function onStoryClick(details) {

    var storyDetails = $('#sd');

    // As the "main" section seems faster when "story-details" is not a separate
    // layer, but the "show and hide" seems faster when it is, I'm toggling this
    // CSS property, to make "story-details" a separate layer when
    // onStoryClick(), until hideStory().
    // "make-layer" could also be applied to "main", but only when it's
    // scrolling, as this seems to worsen the performance when loading the page
    // and when "showing and hiding" stories
    storyDetails.classList.add('make-layer');

    if (details.url)
      details.urlobj = new URL(details.url);

    var comment;
    var commentsElement;
    var storyHeader;
    var storyContent;

    var storyDetailsHtml = storyDetailsTemplate(details);
    var kids = details.kids;
    var commentHtml = storyDetailsCommentTemplate({
      by: '', text: 'Loading comment...'
    });

    storyDetails.innerHTML = storyDetailsHtml;

    commentsElement = storyDetails.querySelector('.js-comments');
    storyHeader = storyDetails.querySelector('.js-header');
    storyContent = storyDetails.querySelector('.js-content');

    var closeButton = storyDetails.querySelector('.js-close');
    closeButton.addEventListener('click', hideStory.bind(this));

    var headerHeight = storyHeader.getBoundingClientRect().height;
    storyContent.style.paddingTop = headerHeight + 'px';

    if (typeof kids === 'undefined')
      return;

    for (var k = 0; k < kids.length; k++) {

      comment = document.createElement('aside');
      comment.setAttribute('id', 'sdc-' + kids[k]);
      comment.classList.add('story-details__comment');
      comment.innerHTML = commentHtml;
      commentsElement.appendChild(comment);

      // Update the comment with the live data.
      APP.Data.getStoryComment(kids[k], function(commentDetails) {

        commentDetails.time *= 1000;

        var comment = commentsElement.querySelector(
            '#sdc-' + commentDetails.id);
        comment.innerHTML = storyDetailsCommentTemplate(
            commentDetails,
            localeData);
      });
    }

    requestAnimationFrame(showStory.bind(this, details.id));
  }

  function showStory(id) {

    if (inDetails)
      return;

    inDetails = true;

    var storyDetails = $('#sd');
    var left = null;

    if (!storyDetails)
      return;

    document.body.classList.add('details-active');
    storyDetails.style.opacity = 1;

    function animate () {

      // Find out where it currently is.
      var storyDetailsPosition = storyDetails.getBoundingClientRect();

      // Set the left value if we don't have one already.
      if (left === null)
        left = storyDetailsPosition.left;

      // Now figure out where it needs to go.
      left += (0 - storyDetailsPosition.left) * 0.1;

      // Set up the next bit of the animation if there is more to do.
      if (Math.abs(left) > 0.5)
        requestAnimationFrame(animate);
      else
        left = 0;

      // And update the styles. Wait, is this a read-write cycle?
      // I hope I don't trigger a forced synchronous layout!
      storyDetails.style.left = left + 'px';
    }

    requestAnimationFrame(animate);
  }

  function hideStory() {

    if (!inDetails)
      return;

    var storyDetails = $('#sd');
    var left = 0;

    document.body.classList.remove('details-active');
    storyDetails.style.opacity = 0;

    function animate () {

      // Find out where it currently is.
      var mainPosition = main.getBoundingClientRect();
      var storyDetailsPosition = storyDetails.getBoundingClientRect();
      var target = mainPosition.width + 100;

      // Now figure out where it needs to go.
      left += (target - storyDetailsPosition.left) * 0.1;

      // Set up the next bit of the animation if there is more to do.
      if (Math.abs(left - target) > 0.5) {
        requestAnimationFrame(animate);
      } else {
        left = target;
        inDetails = false;
      }

      // And update the styles. Wait, is this a read-write cycle?
      // I hope I don't trigger a forced synchronous layout!
      storyDetails.style.left = left + 'px';
      storyDetails.classList.remove('make-layer');
    }

    // We want slick, right, so let's do a setTimeout
    // every few milliseconds. That's going to keep
    // it all tight. Or maybe we're doing visual changes
    // and they should be in a requestAnimationFrame
    requestAnimationFrame(animate);
  }

  // In this function I first calculate all the properties that generate
  // "Forced reflow", and save them in StoryElement objects. Then I read them
  // to update the layout.
  function colorizeAndScaleStories() {
    var order, s;
    for (s = 0; s < storyElements.length; s++) {
      order = parseInt(storyElements[s].story.style.order, 10);
      getScaleSaturationAndOpacity(order);
    }
    for (s = 0; s < storyElements.length; s++) {
      order = parseInt(storyElements[s].story.style.order, 10);
      setScaleSaturationAndOpacity(order);
    }
  }

  function colorizeAndScaleSingleStory(order) {
    getScaleSaturationAndOpacity(order);
    setScaleSaturationAndOpacity(order);
  }

  function getScaleSaturationAndOpacity(order) {
    var storyElement = StoryElement.getStoryByOrder(order);
    var story = storyElement.story;
    var score = story.querySelector('.story__score');
    var title = story.querySelector('.story__title');

    // Base the scale on the y position of the score.
    var height = main.offsetHeight;
    var mainPosition = main.getBoundingClientRect();
    var scoreLocation = score.getBoundingClientRect().top -
        document.body.getBoundingClientRect().top;
    var scale = Math.min(1, 1 - (0.05 * ((scoreLocation - 170) / height)));
    var opacity = Math.min(1, 1 - (0.5 * ((scoreLocation - 170) / height)));

    // Now figure out how wide it is and use that to saturate it.
    scoreLocation = score.getBoundingClientRect();
    var saturation = (100 * (((scale * 40) - 38) / 2));

    storyElement.setScale(scale);
    storyElement.setSaturation(saturation);
    storyElement.setOpacity(opacity);
  }

  function setScaleSaturationAndOpacity(order) {
    var storyElement = StoryElement.getStoryByOrder(order);
    var story = StoryElement.getStoryByOrder(order).story;
    var score = story.querySelector('.story__score');
    var title = story.querySelector('.story__title');

    var scale = storyElement.getScale();
    var saturation = storyElement.getSaturation();
    var opacity = storyElement.getOpacity();

    score.style.width = (scale * 40) + 'px';
    score.style.height = (scale * 40) + 'px';
    score.style.lineHeight = (scale * 40) + 'px';

    score.style.backgroundColor = 'hsl(42, ' + saturation + '%, 50%)';
    title.style.opacity = opacity;
  }

  main.addEventListener('touchstart', function(evt) {

    // I just wanted to test what happens if touchstart
    // gets canceled. Hope it doesn't block scrolling on mobiles...
    if (Math.random() > 0.97) {
      evt.preventDefault();
    }

  });

  // TODO: Could transform translate be used in animateHeader(), as in:
  // https://dl.dropboxusercontent.com/u/2272348/codez/parallax/demo-promo/index.html
  // to avoid paints ???

  // TODO: Would it be useful to try to separate the header from the "main" in
  // different layers ??? Apparently not, because when scrolling the "main"
  // gets painted anyway at populateStoryElements().

  function animateHeader() {
    var header = $('header');
    var headerTitles = header.querySelector('.header__title-wrapper');
    var scrollTopCapped = Math.min(70, main.scrollTop);
    var scaleString = 'scale(' + (1 - (scrollTopCapped / 300)) + ')';
    var mainScrollTop = main.scrollTop;

    //colorizeAndScaleStories();

    header.style.height = (156 - scrollTopCapped) + 'px';
    headerTitles.style.webkitTransform = scaleString;
    headerTitles.style.transform = scaleString;

    // Add a shadow to the header.
    if (mainScrollTop > 70) {
      document.body.classList.add('raised');
    }
    else {
      document.body.classList.remove('raised');
    }
  }

  // Check if we need to load the next batch of stories.
  function checkLoadStoryBatch() {
    var upperOrderStoryElement = StoryElement.getUpperOrderStoryElement();
    waitingStoryBatch = (storiesRequested > storyData.length);
    if (!waitingStoryBatch &&
      parseInt(upperOrderStoryElement.story.style.order, 10) >
      storiesRequested - LAZY_LOAD_THRESHOLD_N_OF_STORIES &&
      stories !== null) {
        console.log("storyData.length (before calling loadStoryBatch()) = " +
          storyData.length);
        loadStoryBatch();
        console.log("loadStoryBatch() called");
      }
  }

  var lastPosition = -1;

  function maybeNeedsSwapping() {
    var currentPosition = $('main').scrollTop;
    var upperOrderStoryElement = StoryElement.getUpperOrderStoryElement();
    var lowerOrderStoryElement = StoryElement.getLowerOrderStoryElement();
    var isAtMinScroll = (currentPosition === 0);
    // https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollHeight
    var isAtMaxScroll =
      (currentPosition === $('main').scrollHeight - $('main').clientHeight);
    var stuckBecauseScrolledToFast = ((lastPosition === currentPosition) &&
      (parseInt(upperOrderStoryElement.story.style.order, 10) !==
      storyData.length - 1) &&
      (parseInt(lowerOrderStoryElement.story.style.order, 10) !== 0) &&
      (isAtMinScroll || isAtMaxScroll));

    if (storyElementPoolCreated && (lastPosition !== currentPosition ||
      stuckBecauseScrolledToFast)) {
      lastPosition = currentPosition;
      return true;
    } else {
      return false;
    }
  }

  var gapToLimits = 0.5;

  function maybeSwapStories() {
    var upperOrderStoryElement = StoryElement.getUpperOrderStoryElement();
    var lowerOrderStoryElement = StoryElement.getLowerOrderStoryElement();
    var lowerOrderStoryElementTop =
      lowerOrderStoryElement.story.getBoundingClientRect().top;
    var upperOrderStoryElementBottom =
      upperOrderStoryElement.story.getBoundingClientRect().top +
      upperOrderStoryElement.story.offsetHeight;
    var storyPoolHeight = upperOrderStoryElementBottom - lowerOrderStoryElementTop;
    var viewportHeight = window.innerHeight;
    var topLimit = -(storyPoolHeight - viewportHeight) / 2 * (1 + gapToLimits);
    var bottomLimit = viewportHeight + (storyPoolHeight - viewportHeight) / 2 *
      (1 + gapToLimits);
    if (lowerOrderStoryElementTop < topLimit) {
      StoryElement.swapToBottom(lowerOrderStoryElement);
      populateSingleStoryElementIfItsElementIsActive(
        parseInt(lowerOrderStoryElement.story.style.order, 10));
      swappedStories = true;
    } else if (upperOrderStoryElementBottom > bottomLimit) {
      StoryElement.swapToTop(upperOrderStoryElement);
      populateSingleStoryElementIfItsElementIsActive(
        parseInt(upperOrderStoryElement.story.style.order, 10));
      swappedStories = true;
    }
  }

  // Based on https://gist.github.com/Warry/4254579. requestAnimationFrame
  // should be faster than scroll event (altough requestAnimationFrame runs
  // always, so I'm not sure if its better overall):
  function scrollLoop(){
      // Avoid calculations if not needed
      if (maybeNeedsSwapping()) {
        swappedStories = false;
        maybeSwapStories();
        if (swappedStories) {
          checkLoadStoryBatch();
        }
        if (StoryElement.getLowerOrderStoryElement().story.style.order <=
          lowerLimitToAnimateHeader) {
          animateHeader();
        }
        colorizeAndScaleStories();
      } else {
        // notEnlargedWhenShould was applied because header sometimes didn't
        // enlarge when scrolling back to the top
        var notEnlargedWhenShould =
          main.scrollTop <= 70 && document.body.classList.contains('raised');
        var notRaisedWhenShould =
          main.scrollTop > 70 && !document.body.classList.contains('raised');
        if (notEnlargedWhenShould || notRaisedWhenShould) {
          animateHeader();
        }
      }
      requestAnimationFrame(scrollLoop);
  }
  scrollLoop();

  function loadStoryBatch() {

    if (storyLoadCount > 0)
      return;

    storyLoadCount = count;

    var end = storiesRequested + count;
    for (var i = storiesRequested; i < end; i++) {

      if (i >= stories.length)
        return;

      var key = String(stories[i]);
      APP.Data.getStoryById(stories[i], onStoryData.bind(this, i, key));
    }

    storiesRequested += count;
  }

  function onStoryData (order, key, details) {
    details.time *= 1000;
    var html = storyTemplate(details);
    /*var stop = false;
    while (!stop) {
      if (storyElementPoolCreated) {
        stop = true;
      }
    }*/
    var newStoryData = new StoryData(order, key, html, details);
    storyData.push(newStoryData);
    storyLoadCount--;
    populateSingleStoryElementIfItsElementIsActive(order);

    var min =
      parseInt(StoryElement.getLowerOrderStoryElement().story.style.order, 10);
    var max =
      parseInt(StoryElement.getUpperOrderStoryElement().story.style.order, 10);
    if (order >= min && order <= max) {
      if (typeof newStoryData !== 'undefined') {
        colorizeAndScaleSingleStory(order);
      }
    }
  }

  function createStoryElementPool() {
    var initialI;
    if (typeof storyElements === 'undefined') {
      initialI = 0;
    } else {
      initialI = storyElements.length;
    }
    for (var i = initialI; i < initialI + StoryElement.getMinPoolSize(); i++) {
      var story = document.createElement('div');
      story.setAttribute('id', 's-' + i);
      story.style.order = i;
      story.classList.add('story');
      story.innerHTML = storyTemplate({
        title: '...',
        score: '-',
        by: '...',
        time: 0
      });
      main.appendChild(story);
      storyElements.push(new StoryElement(story, i));
    }
    if (StoryElement.getUpperOrderStoryElement().story.getBoundingClientRect().top <
      window.innerHeight * (1 + exceedViewportHeightBy)) {
        requestAnimationFrame(createStoryElementPool);
    } else {
      storyElementPoolCreated = true;
    }
  }
  requestAnimationFrame(createStoryElementPool);

  function populateSingleStoryElementIfItsElementIsActive(order) {
    var min =
      parseInt(StoryElement.getLowerOrderStoryElement().story.style.order, 10);
    var max =
      parseInt(StoryElement.getUpperOrderStoryElement().story.style.order, 10);
    if (order >= min && order <= max) {
      var storyData = StoryData.getStoryByOrder(order);
      if (typeof storyData !== 'undefined') {
        var storyElement = storyData.getStoryElementAssigned();
        var story = storyElement.story;
        var html = storyData.innerHTML;
        var details = storyData.details;

        var storyClone = story.cloneNode(true);

        storyClone.innerHTML = html;
        // TODO: I don't know how to remove the listener in a more elegant and
        // efficient way, like:
        // story.removeEventListener('click', onStoryClick.bind(this, details));
        // (that doesn't work) So I had to clone the element, and replaceChild,
        // based on:
        // http://stackoverflow.com/questions/19469881/remove-all-event-listeners-of-specific-type
        story.parentNode.replaceChild(storyClone, story);
        storyElement.story = storyClone;
        storyClone.addEventListener('click',
          onStoryClick.bind(this, details));
        storyClone.classList.add('clickable');
      }
    }
  }


  // Bootstrap in the stories.
  APP.Data.getTopStories(function(data) {
    stories = data;
    loadStoryBatch();
    main.classList.remove('loading');
  });


})();
