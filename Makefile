.PHONY: all clean

all:
	rm -rf dist
	mkdir -p dist
	npx esbuild index.js --bundle --minify --outfile=dist/bundle.min.js
	npx esbuild styles.css --minify --outfile=dist/styles.min.css
	cp index.html favicon.svg dist
	sed -i 's/src="index\.js"/src="bundle.min.js"/g' dist/index.html
	sed -i 's/href="styles\.css"/href="styles.min.css"/g' dist/index.html

clean:
	rm -rf dist
