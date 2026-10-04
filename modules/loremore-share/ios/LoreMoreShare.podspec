Pod::Spec.new do |s|
  s.name = 'LoreMoreShare'
  s.version = '1.0.0'
  s.summary = 'LoreMore private share inbox'
  s.description = s.summary
  s.license = { :type => 'Proprietary' }
  s.author = 'LoreMore'
  s.homepage = 'https://github.com/johnmccants002/loremore'
  s.source = { :git => 'https://github.com/johnmccants002/loremore.git' }
  s.platforms = { :ios => '16.4' }
  s.swift_version = '5.9'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
end
