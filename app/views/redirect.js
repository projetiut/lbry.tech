"use strict";



//  P A C K A G E S

import decamelize from "decamelize";
import exists from "fs-exists-sync";
import fm from "front-matter";
import fs from "graceful-fs";
import html from "choo/html";
import path from "path";
import { require as local } from "app-root-path";
import raw from "choo/html/raw";

//  V A R I A B L E S

const numberRegex = /^[0-9]/g;

const md = require("markdown-it")({
  html: true,
  typographer: true
}).use(local("app/modules/markdown-it-sup"))
  .use(require("markdown-it-anchor"), {
    slugify: stringToSlugify => {
      let finalString = stringToSlugify
        .toLowerCase()
        .replace(/\s\/\s/g, "-")
        .replace(/\s/g, "-")
        .replace(/%/g, "")
        .replace(/\(/g, "")
        .replace(/\)/g, "")
        .replace(/,/g, "");

      if (finalString.match(numberRegex)) finalString = `_${finalString}`;
      return finalString;
    }
  })
  .use(require("markdown-it-wikilinks")({
    makeAllLinksAbsolute: true,
    baseURL: "/glossary#",
    uriSuffix: "",
    htmlAttributes: {
      class: "wikilink"
    }
  }));



//  E X P O R T

module.exports = exports = (state, emit) => { // eslint-disable-line
  let path;

  if (state.route === "resources/*") path = `resources/${state.params.wildcard}`;
  else path = state.params.wildcard;

  if (!fs.existsSync(`./documents/${path}.md`)) {
    return html`
      <article class="page" itemtype="http://schema.org/BlogPosting">
        <header class="page__header">
          <div class="page__header-wrap">
            <div class="inner-wrap">
              <h1 class="page__header__title" itemprop="name headline">404</h1>
            </div>
          </div>
        </header>

        <section class="page__content page__markup" itemprop="articleBody">
          <div class="inner-wrap">
            <p>The page you are looking for does not exist.</p>
          </div>
        </section>
      </article>
    `;
  }

  const markdownFile = fs.readFileSync(`./documents/${path}.md`, "utf-8");
  const markdownFileDetails = fm(markdownFile);
  const renderedMarkdown = md.render(markdownFileDetails.body);
  const updatedMarkdown = partialFinder(renderedMarkdown);
  let newMetadata = "";
  if (markdownFileDetails.attributes.meta) newMetadata = markdownFileDetails.attributes.meta;

  let pageScript = "";
  if (path === "glossary") pageScript = "<script>" + fs.readFileSync("./app/components/client/glossary-scripts.js", "utf-8") + "</script>";
  if (path === "overview") pageScript = "<script>" + fs.readFileSync("./app/components/client/ecosystem-scripts.js", "utf-8") + "</script>";
  if (path === "tour") pageScript = "<script>" + fs.readFileSync("./app/components/client/tour-scripts.js", "utf-8") + "</script>";

  return html`
    <article class="page" itemtype="http://schema.org/BlogPosting">
      <header class="page__header">
        <div class="page__header-wrap">
          <div class="inner-wrap">
            <h1 class="page__header__title" itemprop="name headline">${markdownFileDetails.attributes.title}</h1>
          </div>
        </div>
      </header>

      <section class="page__content" itemprop="articleBody">
        <div class="inner-wrap">
          <div class="page__markup">${raw(updatedMarkdown)}</div>
          ${raw(pageScript)}
          ${newMetadata.length ? raw(updateMetadata(newMetadata)) : ""}
        </div>
      </section>
    </article>
  `;
};



//  H E L P E R S

function createMetaTags(metaObject) {
  /**
    NOTE:
    For Markdown files, the custom yaml should look like this:

    meta:
    - description: Description goes here

    This does not currently work with parameters like "og:image"
    // https://github.com/lbryio/lbry.tech/issues/30
  */

  let html = "";

  for (const metaProperty in metaObject) {
    html += `document.getElementsByTagName("meta")["${metaProperty}"].content = "${metaObject[metaProperty]}";\n`;
  }

  return html;
}

function partialFinder(markdownBody) {
  const regexToFindPartials = /<\w+\/>/g;
  const partials = markdownBody.match(regexToFindPartials);

  if (!partials) return markdownBody;

  for (const partial of partials) {
    const filename = decamelize(partial, "-").replace("<", "").replace("/>", "");
    const fileExistsTest = exists(`./app/components/${filename}.js`); // `local` results in error if used here and file !exist

    if (fileExistsTest) {
      const partialFunction = require(path.join(__dirname, "..", `./components/${filename}.js`));
      const markdownHtml = filename === "glossary-toc" ? partialFunction : partialFunction.default(); //kill special case
      markdownBody = markdownBody.replace(partial, '</div>' +  markdownHtml + '<div class="page__markup">');
    }
  }

  return markdownBody;
}

function updateMetadata(metadataDetails) {
  const generatedMetadata = [];

  for (const metadataDetail of metadataDetails) {
    generatedMetadata.push(createMetaTags(metadataDetail));
  }

  return html`
    <script>${generatedMetadata.join("")}</script>
  `;
}
