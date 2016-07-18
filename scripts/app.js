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
  var $ = document.querySelector.bind(document);

  var stories = null;
  var storyStart = 0;
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

  /**
   * As every single story arrives in shove its
   * content in at that exact moment. Feels like something
   * that should really be handled more delicately, and
   * probably in a requestAnimationFrame callback.
   */
  var elementsToEdit;
  var canvasDataURL;
  var isFirstElement = true;
  function onStoryData (key, details) {

    var story = document.querySelector('#s-' + key);

    if (typeof story !== 'undefined') {
      details.time *= 1000;
      var html = storyTemplate(details);
      story.innerHTML = html;

      // A canvas element is only created for the first story to arrive. This
      // element will then be copied to data url, and pasted to itself and
      // every story as they arrive.
      // I did it like this because creating one canvas for each story
      // generated one (or maybe more?) additional layer, so the performance was
      // low (many "Update Layer Tree" and "Composite Layers"). Maybe there's
      // some way to avoid that layer creation (and that way the code would be
      // cleaner)
      if (isFirstElement) {
        var canvasHTML = "<canvas id='canvas" + key + "' width=" +
          story.offsetWidth + " height=" + story.offsetHeight +
          " style='position: absolute; top: 0; left: 0;'></canvas>";
          story.innerHTML = canvasHTML + story.innerHTML;
      } else {
        story.style.background='url('+canvasDataURL+')';
      }
      story.addEventListener('click', onStoryClick.bind(this, details));
      story.classList.add('clickable');

      // Tick down. When zero we can batch in the next load.
      storyLoadCount--;

      if (isFirstElement) {
        isFirstElement = false;
        var canvas = document.getElementById("canvas" + key);
        var ctx = canvas.getContext("2d");
        var gradient = ctx.createLinearGradient(0,0,0,canvas.height);
        gradient.addColorStop(0,"#FFF");
        gradient.addColorStop(1,"#F4F4F4");
        ctx.fillStyle = gradient;
        ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.beginPath();
        ctx.arc(36, 36, 20, 0, 2 * Math.PI);
        ctx.clip();
        ctx.clearRect(0,0,canvas.width,canvas.height);
        canvasDataURL = canvas.toDataURL();
        canvas.parentNode.removeChild(canvas);
        story.style.background='url('+canvasDataURL+')';
      }
    }

    // Colorize on complete.
    if (count == storyLoadCount + 1) {
      var main = $('main');
      var mainHeight = main.offsetHeight;
      var elementsHeight = story.offsetHeight;
      elementsToEdit = Math.ceil(mainHeight / elementsHeight);
    }

    if ((count - storyLoadCount - 1 < elementsToEdit)) {
      //colorizeAndScaleStories();
    }
  }

  function addMainBackground() {
    mainBackgroundHTML = "<canvas id='mainBackgroundCanvas' width=" +
      main.offsetWidth + " height=" + main.offsetHeight +
      " style='position: absolute; top: 0; left: 0;'></canvas>";
    main.innerHTML = mainBackgroundHTML + main.innerHTML;

    var canvas = document.getElementById("mainBackgroundCanvas");
    var ctx = canvas.getContext("2d");
    var gradient = ctx.createLinearGradient(0,170,0,canvas.height);
    var gradientFactor = 0.85;
    var saturation1 = 1;
    var opacity1 = 1;
    saturation2 = saturation1 - 1 * gradientFactor;
    opacity2 = opacity1 - 0.5 * gradientFactor;
    // The opacity in fact was fixed to 0.87, despite the function
    // colorizeAndScaleStories that seemed like it wanted to change it.
    gradient.addColorStop(0,"hsla(42, " + saturation1 * 100 + "% , 50%, " + 0.87 + ")");
    gradient.addColorStop(1,"hsla(42," + saturation2 * 100 + "% , 50%," + 0.87 + ")");
    ctx.fillStyle = gradient;
    ctx.fillRect(0,0,canvas.width,canvas.height);


  }
  addMainBackground();

  function onStoryClick(details) {

    var storyDetails = $('sd-' + details.id);

    // Wait a little time then show the story details.
    setTimeout(showStory.bind(this, details.id), 60);

    // Create and append the story. A visual change...
    // perhaps that should be in a requestAnimationFrame?
    // And maybe, since they're all the same, I don't
    // need to make a new element every single time? I mean,
    // it inflates the DOM and I can only see one at once.
    if (!storyDetails) {

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

      storyDetails = document.createElement('section');
      storyDetails.setAttribute('id', 'sd-' + details.id);
      storyDetails.classList.add('story-details');
      storyDetails.innerHTML = storyDetailsHtml;

      document.body.appendChild(storyDetails);

      commentsElement = storyDetails.querySelector('.js-comments');
      storyHeader = storyDetails.querySelector('.js-header');
      storyContent = storyDetails.querySelector('.js-content');

      var closeButton = storyDetails.querySelector('.js-close');
      closeButton.addEventListener('click', hideStory.bind(this, details.id));

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
    }

  }

  function showStory(id) {

    if (inDetails)
      return;

    inDetails = true;

    var storyDetails = $('#sd-' + id);
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
        setTimeout(animate, 4);
      else
        left = 0;

      // And update the styles. Wait, is this a read-write cycle?
      // I hope I don't trigger a forced synchronous layout!
      storyDetails.style.left = left + 'px';
    }

    // We want slick, right, so let's do a setTimeout
    // every few milliseconds. That's going to keep
    // it all tight. Or maybe we're doing visual changes
    // and they should be in a requestAnimationFrame
    setTimeout(animate, 4);
  }

  function hideStory(id) {

    if (!inDetails)
      return;

    var storyDetails = $('#sd-' + id);
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
        setTimeout(animate, 4);
      } else {
        left = target;
        inDetails = false;
      }

      // And update the styles. Wait, is this a read-write cycle?
      // I hope I don't trigger a forced synchronous layout!
      storyDetails.style.left = left + 'px';
    }

    // We want slick, right, so let's do a setTimeout
    // every few milliseconds. That's going to keep
    // it all tight. Or maybe we're doing visual changes
    // and they should be in a requestAnimationFrame
    setTimeout(animate, 4);
  }

  /**
   * Apparently this function has a bug. When scrolling about 100 elements down,
   * the colors become all orange, without gradient

   * This function isn't used anymore. I used a background image generated from
   * a "prototype" canvas, with a circle hole for the
   * score, and a fixed background with color gradient. Unfortunately, I didn't
   * resize those holes based on the Y position of the story. But that was a
   * subtle feature.
   * Another option would be to create a pool of some canvases, and recycle
   * them. That way, it would be easy to resize the score, keeping a good
   * performance.
   */
  function colorizeAndScaleStories() {

    var storyElements = document.querySelectorAll('.story');

    // It does seem awfully broad to change all the
    // colors every time!

    var main = $('main');
    var mainHeight = main.offsetHeight;
    var headerHeight = $('.header').offsetHeight;
    var pixelsScrolled = Math.max(0, main.scrollTop - 70);
    var elementsHeight = storyElements[0].offsetHeight;
    var elementsHeightPercentScrolled = (pixelsScrolled / elementsHeight) -
      Math.floor(pixelsScrolled / elementsHeight);
    var elementsScrolled = Math.floor(pixelsScrolled / elementsHeight);
    var elementsToEdit = Math.ceil(mainHeight / elementsHeight);

    for (var s = elementsScrolled; s < elementsScrolled + elementsToEdit; s++) {
      var story = storyElements[s];
      if (typeof story !== 'undefined') {
        var elementPositionOnScreen = s - elementsScrolled;
        var elementTop = headerHeight + elementPositionOnScreen * elementsHeight -
          elementsHeightPercentScrolled * elementsHeight;

        var score = story.querySelector('.story__score');
        var title = story.querySelector('.story__title');

        // Base the scale on the y position of the score.
        var scale = Math.min(1, 1 - (0.05 * ((elementTop - 170) / mainHeight)));
        var opacity = Math.min(1, 1 - (0.5 * ((elementTop - 170) / mainHeight)));

        score.style.width = (scale * 40) + 'px';
        score.style.height = (scale * 40) + 'px';
        score.style.lineHeight = (scale * 40) + 'px';

        // Now figure out how wide it is and use that to saturate it.
        var saturation = (100 * (((scale * 40) - 38) / 2));

        score.style.backgroundColor = 'hsl(42, ' + saturation + '%, 50%)';
        title.style.opacity = opacity;
      }
    }
  }

  main.addEventListener('touchstart', function(evt) {

    // I just wanted to test what happens if touchstart
    // gets canceled. Hope it doesn't block scrolling on mobiles...
    if (Math.random() > 0.97) {
      evt.preventDefault();
    }

  });

  function animateScroll() {
    var header = $('header');
    var headerTitles = header.querySelector('.header__title-wrapper');
    var scrollTopCapped = Math.min(70, main.scrollTop);
    var scaleString = 'scale(' + (1 - (scrollTopCapped / 300)) + ')';
    var mainScrollTop = main.scrollTop;
    var loadThreshold = (main.scrollHeight - main.offsetHeight -
        LAZY_LOAD_THRESHOLD);

    //colorizeAndScaleStories();

    header.style.height = (156 - scrollTopCapped) + 'px';
    headerTitles.style.webkitTransform = scaleString;
    headerTitles.style.transform = scaleString;

    // Add a shadow to the header.
    if (mainScrollTop > 70)
      document.body.classList.add('raised');
    else
      document.body.classList.remove('raised');

    // Check if we need to load the next batch of stories.
    if (mainScrollTop > loadThreshold)
      loadStoryBatch();
  }

  // Based on https://gist.github.com/Warry/4254579. requestAnimationFrame
  // Should be faster than scroll event (altough requestAnimationFrame runs
  // always, so I'm not sure if its better overall):

  var lastPosition = 0;

  function scrollLoop(){
      // Avoid calculations if not needed
      if (lastPosition == $('main').scrollTop) {
          requestAnimationFrame(scrollLoop);
          return false;
      } else {
        lastPosition = $('main').scrollTop;
        animateScroll();
        requestAnimationFrame(scrollLoop);
      }
  }
  scrollLoop();

  function loadStoryBatch() {

    if (storyLoadCount > 0)
      return;

    storyLoadCount = count;

    var end = storyStart + count;
    for (var i = storyStart; i < end; i++) {

      if (i >= stories.length)
        return;

      var key = String(stories[i]);
      var story = document.createElement('div');
      story.setAttribute('id', 's-' + key);
      story.classList.add('story');
      story.innerHTML = storyTemplate({
        title: '...',
        score: '-',
        by: '...',
        time: 0
      });
      main.appendChild(story);

      APP.Data.getStoryById(stories[i], onStoryData.bind(this, key));
    }

    storyStart += count;

  }

  // Bootstrap in the stories.
  APP.Data.getTopStories(function(data) {
    stories = data;
    loadStoryBatch();
    main.classList.remove('loading');
  });


})();
