$(() => {
  $(".results-slide-row").each((switcher_index, switcher) => {
    const $switcher = $(switcher);

    $switcher.children().each((switcher_child_index, child) => {
      const $child = $(child);
      const $input = $("<button>", {
        class: "thumbnail-btn",
        id: $child.data("id"),
      });
      const $img = $("<img>", {
        class: "thumbnails",
        alt: "paper",
        src: $child.data("img-src"),
      });
      $input.append($img);
      const $label = $("<label>", {
        text: $child.data("label"),
        class: "thumbnail_label",
      });
      $input.append($label);
      $switcher.append($input);
    });
  });
});
// Array of iframe IDs
const iframeIds = ['bear', 'nerfgun', 'scissors','sunglasses','redbox','ledlight','stapler','wirecutters','usbplug'];
const videoIds = ['bear_video', 'nerfgun_video', 'redbox_video', 'scissors_video', 'sunglasses_video', 'ledlight_video', 'stapler_video', 'wirecutters_video', 'usbplug_video'];

// Function to show the selected iframe and hide others
function showIframe(iframeId) {
  iframeIds.forEach(id => {
    const iframe = document.getElementById(id);
    // console.log(iframe);
    if (iframe) {
      if (id === iframeId) {
        iframe.classList.add('show');
        iframe.src = $(iframe).data('src');
      } else {
        iframe.classList.remove('show');
        iframe.src = "";
      }
    }
  });
}
// Function to show the selected video and hide others
function showVideo(videoId) {
  videoIds.forEach(id => {
    const video = document.getElementById(id);
    if (video) {
      if (id === videoId) {
        video.classList.add('show');
        video.querySelector('video').play(); // Play the selected video
      } else {
        video.classList.remove('show');
        video.querySelector('video').pause(); // Pause other videos
        video.querySelector('video').currentTime = 0; //Also restart all others
      }
    }
  });
}

let currentThumbnail = 0;
let thumbnailFromIndex = {}
let thumbnailCount = 0;

// Function to set up thumbnail click events
function setupThumbnailClickEvents() {
  $('.thumbnail-btn').each((index, thumbnail) => {
    thumbnailCount += 1;
    thumbnailFromIndex[index] = thumbnail;
    $(thumbnail).click(function() {
      const buttonId = $(thumbnail).attr('id');
      if (buttonId === undefined) return;
      const iframeId = buttonId.replace('-thumb', '');

      currentThumbnail = index;
      $('.thumbnail-btn').css('opacity', '');
      $(thumbnail).css('opacity', '1.0');
      showIframe(iframeId);
      showVideo(iframeId + '_video');

      // Make sure the new thumbnail is visible.
      const slider_window = document.getElementById('results-objs-scroll');
      slider_window.scrollLeft = thumbnail.offsetLeft - slider_window.offsetWidth / 2;
    });
  });

  $(thumbnailFromIndex[0]).click();
}

// For main results object carousel -- left/right arrow clicks to navigate
function results_slide_left() {
  const newIndex = ((currentThumbnail - 1 + thumbnailCount) % thumbnailCount);
  const newThumbnail = thumbnailFromIndex[newIndex];
  $(newThumbnail).click();
}
function results_slide_right() {
  const newIndex = (currentThumbnail + 1) % thumbnailCount;
  const newThumbnail = thumbnailFromIndex[newIndex];
  $(newThumbnail).click();
}



// Randomize the order of the two co-first authors (Kush & Justin) on each load.
// 50% chance Justin appears before Kush.
function randomizeCoFirstAuthors() {
  const kush = document.getElementById('author-kush');
  const justin = document.getElementById('author-justin');
  if (!kush || !justin) return;
  if (Math.random() < 0.5) {
    // Swap the rendered author and destination while preserving the spacer nodes.
    const tmp = kush.innerHTML;
    const tmpHref = kush.getAttribute('href');
    kush.innerHTML = justin.innerHTML;
    kush.setAttribute('href', justin.getAttribute('href'));
    justin.innerHTML = tmp;
    justin.setAttribute('href', tmpHref);
  }
}

function setupRealResultsMetricToggle() {
  const toggle = document.querySelector('[data-real-plot-toggle]');
  const chart = document.getElementById('real-results-chart');
  if (!toggle || !chart) return;

  const buttons = Array.from(toggle.querySelectorAll('button[data-plot-src]'));
  buttons.forEach(button => {
    const image = new Image();
    image.src = button.dataset.plotSrc;

    button.addEventListener('click', () => {
      chart.src = button.dataset.plotSrc;
      chart.alt = button.dataset.plotAlt;
      buttons.forEach(option => {
        const active = option === button;
        option.classList.toggle('active', active);
        option.setAttribute('aria-pressed', String(active));
      });
    });
  });
}

function setupSectionIndex() {
  const start = document.getElementById('section-index-start');
  if (!start) return;

  const headings = Array.from(document.querySelectorAll('.section h1:not(.tldr), .section h2'))
    .filter(heading => start.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING);
  if (!headings.length) return;

  const usedIds = new Set(Array.from(document.querySelectorAll('[id]'), element => element.id));
  headings.forEach((heading, index) => {
    if (heading.id) return;

    const baseId = heading.textContent
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || `section-${index + 1}`;
    let id = baseId;
    let suffix = 2;
    while (usedIds.has(id)) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }
    heading.id = id;
    usedIds.add(id);
  });

  const nav = document.createElement('nav');
  nav.className = 'section-index';
  nav.setAttribute('aria-label', 'Page sections');

  const list = document.createElement('ol');
  list.className = 'section-index-list';
  const links = headings.map(heading => {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = `#${heading.id}`;
    link.textContent = heading.textContent.trim();
    link.dataset.headingLevel = heading.tagName.slice(1);
    item.appendChild(link);
    list.appendChild(item);
    return link;
  });
  nav.appendChild(list);
  document.body.appendChild(nav);

  let updateQueued = false;
  const updateIndex = () => {
    updateQueued = false;
    const firstHeadingTop = headings[0].getBoundingClientRect().top;
    nav.style.top = `${Math.max(24, firstHeadingTop)}px`;

    const activationLine = Math.min(180, window.innerHeight * 0.28);
    let activeIndex = 0;
    headings.forEach((heading, index) => {
      if (heading.getBoundingClientRect().top <= activationLine) {
        activeIndex = index;
      }
    });
    links.forEach((link, index) => {
      const active = index === activeIndex;
      link.classList.toggle('is-active', active);
      if (active) {
        link.setAttribute('aria-current', 'location');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  };

  const queueIndexUpdate = () => {
    if (updateQueued) return;
    updateQueued = true;
    window.requestAnimationFrame(updateIndex);
  };

  let scrollAnimationFrame = null;
  const scrollToHeading = heading => {
    if (scrollAnimationFrame !== null) {
      window.cancelAnimationFrame(scrollAnimationFrame);
    }

    const startY = window.scrollY;
    const targetY = startY + heading.getBoundingClientRect().top;
    const distance = targetY - startY;
    const duration = Math.min(300, Math.max(180, Math.abs(distance) * 0.12));
    const startTime = performance.now();

    const step = currentTime => {
      const progress = Math.min((currentTime - startTime) / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      window.scrollTo(0, startY + distance * easedProgress);
      if (progress < 1) {
        scrollAnimationFrame = window.requestAnimationFrame(step);
      } else {
        scrollAnimationFrame = null;
      }
    };
    scrollAnimationFrame = window.requestAnimationFrame(step);
  };

  links.forEach((link, index) => {
    link.addEventListener('click', event => {
      event.preventDefault();
      scrollToHeading(headings[index]);
      history.replaceState(null, '', link.hash);
    });
  });

  updateIndex();
  window.addEventListener('scroll', queueIndexUpdate, { passive: true });
  window.addEventListener('resize', queueIndexUpdate);

  const teaserSection = document.querySelector('.teaser-section');
  const teaserVideo = document.getElementById('main-video');
  if ('ResizeObserver' in window && teaserSection) {
    const teaserObserver = new ResizeObserver(queueIndexUpdate);
    teaserObserver.observe(teaserSection);
  }
  if (teaserVideo) {
    teaserVideo.addEventListener('loadedmetadata', queueIndexUpdate);
    teaserVideo.addEventListener('loadeddata', queueIndexUpdate);
  }
  if (document.fonts?.ready) {
    document.fonts.ready.then(queueIndexUpdate);
  }
}

function formatPlaybackTime(seconds) {
  if (!Number.isFinite(seconds)) return "--:--";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function setupDistractorPlaybackControls() {
  document.querySelectorAll(".distractor-comparison").forEach(figure => {
    const video = figure.querySelector("video");
    if (!video || figure.querySelector(".distractor-playback-controls")) return;

    const controls = document.createElement("div");
    controls.className = "distractor-playback-controls";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "distractor-play-toggle";
    toggle.title = "Play";
    toggle.setAttribute("aria-label", "Play comparison");

    const scrubber = document.createElement("input");
    scrubber.type = "range";
    scrubber.className = "distractor-scrubber";
    scrubber.min = "0";
    scrubber.max = "1000";
    scrubber.step = "1";
    scrubber.value = "0";
    scrubber.disabled = true;
    scrubber.setAttribute("aria-label", "Seek comparison video");

    const time = document.createElement("span");
    time.className = "distractor-playback-time";
    time.textContent = "0:00 / --:--";

    controls.append(toggle, scrubber, time);
    figure.appendChild(controls);
    video.controls = false;

    let scrubbing = false;
    const updateToggle = () => {
      const paused = video.paused;
      toggle.innerHTML = `<i class="ti ${paused ? "ti-player-play" : "ti-player-pause"}" aria-hidden="true"></i>`;
      toggle.title = paused ? "Play" : "Pause";
      toggle.setAttribute("aria-label", `${paused ? "Play" : "Pause"} comparison`);
    };

    const updateProgress = () => {
      const duration = video.duration;
      const current = Number.isFinite(video.currentTime) ? video.currentTime : 0;
      if (Number.isFinite(duration) && duration > 0) {
        scrubber.disabled = false;
        if (!scrubbing) scrubber.value = String(Math.round((current / duration) * 1000));
        scrubber.style.setProperty("--seek-progress", `${Math.min((current / duration) * 100, 100)}%`);
      }
      time.textContent = `${formatPlaybackTime(current)} / ${formatPlaybackTime(duration)}`;
    };

    const togglePlayback = () => {
      if (video.paused) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    };

    const seekFromScrubber = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) return;
      video.currentTime = (Number(scrubber.value) / 1000) * video.duration;
      updateProgress();
    };

    const beginScrub = () => {
      scrubbing = true;
    };

    const endScrub = () => {
      if (!scrubbing) return;
      scrubbing = false;
      seekFromScrubber();
      updateProgress();
    };

    toggle.addEventListener("click", togglePlayback);
    video.addEventListener("play", updateToggle);
    video.addEventListener("pause", updateToggle);
    video.addEventListener("loadedmetadata", updateProgress);
    video.addEventListener("durationchange", updateProgress);
    video.addEventListener("timeupdate", updateProgress);
    scrubber.addEventListener("pointerdown", beginScrub);
    scrubber.addEventListener("input", seekFromScrubber);
    scrubber.addEventListener("pointerup", endScrub);
    scrubber.addEventListener("pointercancel", endScrub);
    scrubber.addEventListener("change", endScrub);
    scrubber.addEventListener("wheel", event => {
      if (!Number.isFinite(video.duration)) return;
      event.preventDefault();
      video.currentTime = Math.min(
        Math.max(video.currentTime + (event.deltaY > 0 ? 0.5 : -0.5), 0),
        video.duration
      );
      updateProgress();
    }, { passive: false });

    updateToggle();
    updateProgress();
  });
}

// Initialize the page
function initializePage() {
  randomizeCoFirstAuthors();
  setupRealResultsMetricToggle();
  setupSectionIndex();
  setupDistractorPlaybackControls();
  setupThumbnailClickEvents();

  // Show the first iframe by default
  if (iframeIds.length > 0) {
    showIframe(iframeIds[0]);
  }
  if (videoIds.length > 0) {
    showVideo(videoIds[0]);
  }
}
// Run initialization when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initializePage);

// // Get event listener for when window resized
// window.addEventListener('resize', () => {
//   // Resize the video arrows to be in the right place.
//   const prev_arr = document.getElementById('vid-slide-arrow-prev');
//   const next_arr = document.getElementById('vid-slide-arrow-next');
//   console.log("foo", prev_arr.style);
// });
